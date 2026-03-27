import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Full prerequisite chain using recursive CTE.
 * Returns a flattened list with depth, requirement_group, relationship_type.
 * Depth cap of 10 with cycle guard.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return errorResponse("INVALID_ID", "Invalid course ID format.", 400);
    }

    // Check course exists and get its catalog version
    const course = await db
      .select({
        id: courses.id,
        catalogVersionId: courses.catalogVersionId,
      })
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!course) {
      return errorResponse("NOT_FOUND", "Course not found.", 404);
    }

    // Recursive CTE to traverse the prerequisite chain
    // Includes cycle guard (visited_path) and depth cap of 10
    const prereqChain = await db.execute(sql`
      WITH RECURSIVE prereq_chain AS (
        -- Base case: direct prerequisites of the target course
        SELECT
          cp.prerequisite_id AS course_id,
          c.code,
          c.name,
          cp.relationship_type,
          cp.requirement_group,
          cp.minimum_grade,
          cp.is_recommended,
          1 AS depth,
          ARRAY[cp.prerequisite_id] AS visited_path
        FROM course_prerequisites cp
        JOIN courses c ON c.id = cp.prerequisite_id
        WHERE cp.course_id = ${id}
          AND cp.catalog_version_id = ${course.catalogVersionId}

        UNION ALL

        -- Recursive case: prerequisites of prerequisites
        SELECT
          cp.prerequisite_id AS course_id,
          c.code,
          c.name,
          cp.relationship_type,
          cp.requirement_group,
          cp.minimum_grade,
          cp.is_recommended,
          pc.depth + 1 AS depth,
          pc.visited_path || cp.prerequisite_id
        FROM course_prerequisites cp
        JOIN courses c ON c.id = cp.prerequisite_id
        JOIN prereq_chain pc ON pc.course_id = cp.course_id
        WHERE cp.catalog_version_id = ${course.catalogVersionId}
          AND pc.depth < 10
          AND NOT (cp.prerequisite_id = ANY(pc.visited_path))
      )
      SELECT DISTINCT ON (course_id, depth)
        course_id,
        code,
        name,
        relationship_type,
        requirement_group,
        minimum_grade,
        is_recommended,
        depth
      FROM prereq_chain
      ORDER BY depth ASC, course_id
    `);

    return successResponse(prereqChain.rows);
  } catch (error) {
    console.error("[courses/:id/prereqs] Unexpected error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
