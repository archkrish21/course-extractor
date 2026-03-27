import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  courses,
  divisions,
  departments,
  courseCatalogVersions,
} from "@/lib/db/schema";
import { eq, and, ilike, or, desc, gt, asc, sql } from "drizzle-orm";
import { paginatedResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { getAuthenticatedUser } from "@/lib/auth/get-user";

const querySchema = z.object({
  q: z.string().optional(),
  division: z.string().optional(), // accepts UUID or division name
  department: z.string().optional(), // accepts UUID or department name
  credit_type: z.string().optional(), // Single value or comma-separated: "AP", "AP,CP", "Honors,AP"
  grade_level: z.string().optional(), // Single value or comma-separated: "9", "9,10", "11,12"
  is_ap: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  is_dual_credit: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  gpa_waiver: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  semester_offered: z.coerce.number().int().min(1).max(2).optional(),
  semester_both: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  duration: z.enum(["semester", "full_year"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30/min per user or per IP
    const user = await getAuthenticatedUser();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateLimitKey = user ? `courses:${user.id}` : `courses:ip:${ip}`;

    const rateLimitResult = await rateLimit(rateLimitKey, 30, 60);
    if (!rateLimitResult.success) {
      return errorResponse(
        "RATE_LIMITED",
        `Rate limit exceeded. Try again in ${rateLimitResult.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
        429,
        {
          retry_after:
            rateLimitResult.resetAt - Math.floor(Date.now() / 1000),
        }
      );
    }

    // Parse query params
    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const parsed = querySchema.safeParse(rawParams);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        400
      );
    }

    const { q, division, department, credit_type, grade_level, is_ap, is_dual_credit, gpa_waiver, semester_offered, semester_both, duration, cursor, limit } =
      parsed.data;

    // Decode cursor (base64-encoded JSON: { name, code, id })
    let cursorData: { name: string; code: string; id: string } | null = null;
    if (cursor) {
      try {
        cursorData = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      } catch {
        return errorResponse("INVALID_CURSOR", "Invalid cursor value.", 400);
      }
    }

    // Get the latest catalog version
    const latestVersion = await db
      .select({ id: courseCatalogVersions.id })
      .from(courseCatalogVersions)
      .orderBy(desc(courseCatalogVersions.loadedAt))
      .limit(1)
      .then((rows) => rows[0]);

    if (!latestVersion) {
      return paginatedResponse([], false, null);
    }

    // Build conditions
    const conditions = [
      eq(courses.isActive, true),
      eq(courses.catalogVersionId, latestVersion.id),
    ];

    if (q) {
      const searchTerm = `%${q}%`;
      conditions.push(
        or(ilike(courses.name, searchTerm), ilike(courses.code, searchTerm))!
      );
    }

    if (division) {
      // Accept division as UUID or name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(division);
      if (isUuid) {
        conditions.push(eq(courses.divisionId, division));
      } else {
        conditions.push(eq(divisions.name, division));
      }
    }

    if (department) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(department);
      if (isUuid) {
        conditions.push(eq(courses.departmentId, department));
      } else {
        conditions.push(eq(departments.name, department));
      }
    }

    if (credit_type) {
      const types = credit_type.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        conditions.push(sql`${courses.creditType} = ${types[0]}`);
      } else if (types.length > 1) {
        conditions.push(sql`${courses.creditType} IN (${sql.join(types.map(t => sql`${t}`), sql`, `)})`);
      }
    }

    if (grade_level !== undefined && grade_level !== null) {
      const grades = grade_level.split(",").map((g) => parseInt(g.trim(), 10)).filter((g) => !isNaN(g));
      if (grades.length === 1) {
        conditions.push(sql`${grades[0]} = ANY(${courses.gradeLevels})`);
      } else if (grades.length > 1) {
        // Course must match ANY of the selected grade levels
        conditions.push(sql`(${sql.join(grades.map(g => sql`${g} = ANY(${courses.gradeLevels})`), sql` OR `)})`);
      }
    }

    if (is_ap !== undefined) {
      conditions.push(eq(courses.isAp, is_ap));
    }

    if (is_dual_credit !== undefined) {
      conditions.push(eq(courses.isDualCredit, is_dual_credit));
    }

    if (gpa_waiver !== undefined) {
      conditions.push(eq(courses.gpaWaiver, gpa_waiver));
    }

    if (semester_offered !== undefined) {
      // Show courses in this semester that do NOT have a partner in the other semester
      conditions.push(sql`${semester_offered} = ANY(${courses.semestersOffered})`);
      conditions.push(sql`NOT EXISTS (
        SELECT 1 FROM ${courses} AS c2
        WHERE c2.name = ${courses.name}
          AND c2.id != ${courses.id}
          AND c2.duration = 'semester'
          AND c2.is_active = true
          AND c2.catalog_version_id = ${courses.catalogVersionId}
      )`);
    }

    if (semester_both) {
      // Find semester courses where another course with the same name exists in the other semester
      conditions.push(eq(courses.duration, "semester"));
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${courses} AS c2
        WHERE c2.name = ${courses.name}
          AND c2.id != ${courses.id}
          AND c2.duration = 'semester'
          AND c2.is_active = true
          AND c2.catalog_version_id = ${courses.catalogVersionId}
      )`);
    }

    if (duration) {
      conditions.push(eq(courses.duration, duration));
    }

    if (cursorData) {
      // Composite cursor: (name, code, id) for deterministic sort
      conditions.push(sql`(${courses.name}, ${courses.code}, ${courses.id}) > (${cursorData.name}, ${cursorData.code}, ${cursorData.id})`);
    }

    // Query courses with division and department joined
    const results = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        description: courses.description,
        creditValue: courses.creditValue,
        duration: courses.duration,
        gradeLevels: courses.gradeLevels,
        creditType: courses.creditType,
        isAp: courses.isAp,
        isDualCredit: courses.isDualCredit,
        isHonors: courses.isHonors,
        gpaWaiver: courses.gpaWaiver,
        semestersOffered: courses.semestersOffered,
        divisionId: courses.divisionId,
        divisionName: divisions.name,
        divisionCode: divisions.code,
        departmentId: courses.departmentId,
        departmentName: departments.name,
      })
      .from(courses)
      .innerJoin(divisions, eq(courses.divisionId, divisions.id))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(and(...conditions))
      .orderBy(asc(courses.name), asc(courses.code), asc(courses.id))
      .limit(limit + 1); // fetch one extra to check has_more

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    const lastItem = data[data.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? Buffer.from(JSON.stringify({ name: lastItem.name, code: lastItem.code, id: lastItem.id })).toString("base64")
        : null;

    // Count total matching courses (same filters, excluding cursor condition)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(courses)
      .innerJoin(divisions, eq(courses.divisionId, divisions.id))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(and(...(cursorData ? conditions.slice(0, -1) : conditions)));

    return paginatedResponse(data, hasMore, nextCursor, countResult?.count ?? 0);
  } catch (error) {
    console.error("[courses] Unexpected error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
