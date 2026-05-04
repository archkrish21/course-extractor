import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  courses,
  divisions,
  departments,
  courseCatalogVersions,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, or, isNull } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { getAuthenticatedUser } from "@/lib/auth/get-user";

interface DepartmentDto {
  id: string;
  name: string;
}

interface DivisionDto {
  id: string;
  name: string;
  code: string;
  departments: DepartmentDto[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateLimitKey = user ? `divisions:${user.id}` : `divisions:ip:${ip}`;

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

    const latestVersion = await db
      .select({ id: courseCatalogVersions.id })
      .from(courseCatalogVersions)
      .orderBy(desc(courseCatalogVersions.loadedAt))
      .limit(1)
      .then((rows) => rows[0]);

    if (!latestVersion) {
      return successResponse<DivisionDto[]>([]);
    }

    // Pull divisions + departments that have at least one active, non-summer
    // course in the current catalog version. Summer-only courses use negative
    // values in `semesters_offered` (e.g. [-2], [-1], [-2, -1]); regular
    // courses use NULL (full year) or positive values [1], [2], [1, 2]. The
    // categorical browse hides summer-only categories so the dropdown
    // matches the catalog browse, not the summer browse (the latter is
    // reachable via the "Summer" semester filter pill).
    // LEFT JOIN keeps divisions whose courses have no department row.
    const rows = await db
      .selectDistinct({
        divisionId: divisions.id,
        divisionName: divisions.name,
        divisionCode: divisions.code,
        departmentId: departments.id,
        departmentName: departments.name,
      })
      .from(courses)
      .innerJoin(divisions, eq(courses.divisionId, divisions.id))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(
        and(
          eq(courses.isActive, true),
          eq(courses.catalogVersionId, latestVersion.id),
          or(
            isNull(courses.semestersOffered),
            sql`${courses.semestersOffered} && ARRAY[1, 2]::int[]`,
          ),
        ),
      )
      // Sort alphabetically — `display_order` in this DB is a stale seed
      // artifact (some rows are 0, others 1-10) and would produce a confusing
      // mixed order. Alphabetical matches the prior hardcoded dropdowns.
      .orderBy(asc(divisions.name), asc(departments.name));

    const byDivision = new Map<string, DivisionDto>();
    for (const row of rows) {
      let div = byDivision.get(row.divisionId);
      if (!div) {
        div = {
          id: row.divisionId,
          name: row.divisionName,
          code: row.divisionCode,
          departments: [],
        };
        byDivision.set(row.divisionId, div);
      }
      if (row.departmentId && row.departmentName) {
        const seen = div.departments.some((d) => d.id === row.departmentId);
        if (!seen) {
          div.departments.push({
            id: row.departmentId,
            name: row.departmentName,
          });
        }
      }
    }

    return successResponse<DivisionDto[]>(Array.from(byDivision.values()));
  } catch (error) {
    console.error("[divisions] Unexpected error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500,
    );
  }
}
