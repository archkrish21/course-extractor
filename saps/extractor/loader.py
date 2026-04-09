#!/usr/bin/env python3
"""
Stevenson High School Course Catalog — Database Loader

Reads a courses.json file produced by extract.py and loads it into
the PostgreSQL database specified by the DATABASE_URL environment variable.

Usage:
    python loader.py <path-to-courses.json> [--dry-run] [--force] [--rollback]

Flags:
    --dry-run   Show the diff (adds/removes/modifies) without writing to the DB.
    --force     Override the ±20% course-count safety check.
    --rollback  Revert to the previous catalog version (soft-delete latest).
"""

import argparse
import json
import os
import sys
from collections import defaultdict, deque
from datetime import datetime, timezone

import logging
import warnings

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None  # type: ignore[assignment]
    warnings.warn(
        "psycopg2 is not installed. Database operations will not be available. "
        "Install with: pip install psycopg2-binary",
        ImportWarning,
        stacklevel=1,
    )

# ---------------------------------------------------------------------------
# Topological sort (Kahn's algorithm) — cycle detection
# ---------------------------------------------------------------------------

def topological_sort(courses: list[dict]) -> tuple[list[str], list[list[str]]]:
    """
    Build a prerequisite graph from the courses list and perform a
    topological sort using Kahn's algorithm.

    Returns:
        (sorted_codes, cycles)
        - sorted_codes: topologically sorted course codes (empty if cycles found)
        - cycles: list of cycle paths (empty if DAG is valid)
    """
    # Build adjacency list: prerequisite_code -> [dependent_code, ...]
    graph: dict[str, list[str]] = defaultdict(list)
    in_degree: dict[str, int] = {}

    # Collect all codes (including composite codes expanded)
    all_codes: set[str] = set()
    for c in courses:
        code = c["code"]
        all_codes.add(code)
        if "/" in code:
            all_codes.update(code.split("/"))

    for code in all_codes:
        in_degree.setdefault(code, 0)

    # Build edges: prereq -> course
    for c in courses:
        course_code = c["code"]
        for prereq_code in c.get("prerequisite_codes", []):
            # Only add edges for codes that exist in our catalog
            if prereq_code in all_codes or any(
                prereq_code in ac for ac in all_codes if "/" in ac
            ):
                graph[prereq_code].append(course_code)
                in_degree[course_code] = in_degree.get(course_code, 0) + 1

    # Kahn's algorithm
    queue = deque([node for node, deg in in_degree.items() if deg == 0])
    sorted_codes = []

    while queue:
        node = queue.popleft()
        sorted_codes.append(node)
        for neighbor in graph.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # If not all nodes are in the sorted result, there are cycles
    if len(sorted_codes) < len(in_degree):
        remaining = set(in_degree.keys()) - set(sorted_codes)
        # Find cycle paths
        cycles = _find_cycles(graph, remaining)
        return [], cycles

    return sorted_codes, []


def _find_cycles(
    graph: dict[str, list[str]], remaining: set[str]
) -> list[list[str]]:
    """Find cycle paths within the remaining (unvisited) nodes."""
    cycles = []
    visited: set[str] = set()

    for start in remaining:
        if start in visited:
            continue
        path = []
        path_set: set[str] = set()
        stack = [(start, False)]

        while stack:
            node, backtrack = stack.pop()
            if backtrack:
                path.pop()
                path_set.discard(node)
                continue

            if node in path_set:
                # Found a cycle
                cycle_start = path.index(node)
                cycles.append(path[cycle_start:] + [node])
                continue

            if node in visited:
                continue

            path.append(node)
            path_set.add(node)
            stack.append((node, True))  # backtrack marker

            for neighbor in graph.get(node, []):
                if neighbor in remaining:
                    stack.append((neighbor, False))

        visited.update(path_set)

    return cycles


# ---------------------------------------------------------------------------
# Diff computation
# ---------------------------------------------------------------------------

def compute_diff(
    existing_courses: dict[str, dict],
    new_courses: dict[str, dict],
) -> dict:
    """
    Compare existing DB courses with new courses.json.
    Returns a diff summary.
    """
    existing_codes = set(existing_courses.keys())
    new_codes = set(new_courses.keys())

    added = new_codes - existing_codes
    removed = existing_codes - new_codes
    common = existing_codes & new_codes

    modified = []
    for code in common:
        old = existing_courses[code]
        new = new_courses[code]
        changes = {}
        for field in ("name", "credit_value", "duration", "credit_type",
                      "grade_levels", "prerequisites", "description"):
            old_val = old.get(field)
            new_val = new.get(field)
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
        if changes:
            modified.append({"code": code, "changes": changes})

    return {
        "added": sorted(added),
        "removed": sorted(removed),
        "modified": modified,
        "counts": {
            "added": len(added),
            "removed": len(removed),
            "modified": len(modified),
            "unchanged": len(common) - len(modified),
        },
    }


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

def get_connection():
    """Create a PostgreSQL connection from DATABASE_URL."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if psycopg2 is None:
        print("ERROR: psycopg2 is not installed. Run: pip install psycopg2-binary",
              file=sys.stderr)
        sys.exit(1)
    return psycopg2.connect(url)


def fetch_existing_courses(conn, catalog_version_id: str | None = None) -> dict[str, dict]:
    """Fetch current courses from the database."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if catalog_version_id:
        cur.execute(
            "SELECT * FROM courses WHERE catalog_version_id = %s AND is_active = TRUE",
            (catalog_version_id,),
        )
    else:
        # Get the latest catalog version by loaded_at
        cur.execute(
            "SELECT id FROM course_catalog_versions "
            "ORDER BY loaded_at DESC LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            return {}
        cur.execute(
            "SELECT * FROM courses WHERE catalog_version_id = %s AND is_active = TRUE",
            (row["id"],),
        )

    courses = {}
    for row in cur.fetchall():
        courses[row["code"]] = dict(row)
    cur.close()
    return courses


def load_courses(conn, courses_data: dict, diff: dict, force: bool = False, force_reload: bool = False):
    """Insert/update catalog_version, divisions, departments, courses, prerequisites.

    By default uses UPSERT to preserve existing course IDs (safe for FK references).
    Use force_reload=True for the old DELETE+INSERT behavior (breaks FK references).
    """
    catalog_year = courses_data["catalog_year"]
    courses = courses_data["courses"]
    now = datetime.now(timezone.utc)
    cur = conn.cursor()

    try:
        # 1. Create catalog_version
        school_year = f"{catalog_year}-{catalog_year + 1}"
        cur.execute(
            """INSERT INTO course_catalog_versions
               (school_year, source_pdf_url, change_summary, courses_added, courses_removed, courses_modified, loaded_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (school_year) DO UPDATE SET
                 source_pdf_url = EXCLUDED.source_pdf_url,
                 change_summary = EXCLUDED.change_summary,
                 courses_added = EXCLUDED.courses_added,
                 courses_removed = EXCLUDED.courses_removed,
                 courses_modified = EXCLUDED.courses_modified,
                 loaded_at = EXCLUDED.loaded_at
               RETURNING id""",
            (
                school_year,
                courses_data.get("pdf_path", ""),
                json.dumps(diff["counts"]),
                diff["counts"]["added"],
                diff["counts"]["removed"],
                diff["counts"]["modified"],
                now,
            ),
        )
        version_id = cur.fetchone()[0]
        print(f"  Created catalog version: {version_id}")

        # Deactivate courses from previous versions
        cur.execute(
            "UPDATE courses SET is_active = FALSE WHERE catalog_version_id != %s AND is_active = TRUE",
            (version_id,),
        )

        # 2. Upsert divisions
        divisions = set()
        for c in courses:
            divisions.add(c["division"])

        division_ids = {}
        for div_name in sorted(divisions):
            # Generate a code from the division name (e.g., "Fine Arts" -> "FINE_ARTS")
            div_code = div_name.upper().replace(" ", "_").replace(",", "").replace("&", "AND")[:20]
            cur.execute(
                """INSERT INTO divisions (name, code)
                   VALUES (%s, %s)
                   ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
                (div_name, div_code),
            )
            division_ids[div_name] = cur.fetchone()[0]

        # 3. Upsert departments
        departments = set()
        for c in courses:
            departments.add((c["division"], c["department"]))

        department_ids = {}
        for div_name, dept_name in sorted(departments):
            cur.execute(
                """INSERT INTO departments (name, division_id)
                   VALUES (%s, %s)
                   ON CONFLICT (division_id, name)
                   DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
                (dept_name, division_ids[div_name]),
            )
            department_ids[(div_name, dept_name)] = cur.fetchone()[0]

        # 4. Upsert courses (preserves existing IDs to avoid breaking FK references)
        # If --force-reload is used, fall back to DELETE+INSERT
        if force_reload:
            cur.execute(
                "DELETE FROM plan_courses WHERE course_id IN (SELECT id FROM courses WHERE catalog_version_id = %s)",
                (version_id,),
            )
            cur.execute(
                "DELETE FROM grade_entries WHERE course_id IN (SELECT id FROM courses WHERE catalog_version_id = %s)",
                (version_id,),
            )
            cur.execute(
                "DELETE FROM dual_credit_log WHERE course_id IN (SELECT id FROM courses WHERE catalog_version_id = %s)",
                (version_id,),
            )
            cur.execute(
                "DELETE FROM alerts WHERE related_course_id IN (SELECT id FROM courses WHERE catalog_version_id = %s)",
                (version_id,),
            )
            cur.execute(
                "DELETE FROM career_path_courses WHERE course_id IN (SELECT id FROM courses WHERE catalog_version_id = %s)",
                (version_id,),
            )
            cur.execute("DELETE FROM course_prerequisites WHERE catalog_version_id = %s", (version_id,))
            cur.execute("DELETE FROM courses WHERE catalog_version_id = %s", (version_id,))

        # Build lookup of existing course IDs by code for this catalog version
        existing_by_code = {}
        if not force_reload:
            cur.execute(
                "SELECT id, code FROM courses WHERE catalog_version_id = %s",
                (version_id,),
            )
            for row in cur.fetchall():
                existing_by_code[row[1]] = row[0]

        course_ids = {}
        new_codes = set()
        for c in courses:
            div_id = division_ids[c["division"]]
            dept_id = department_ids[(c["division"], c["department"])]
            new_codes.add(c["code"])

            if not force_reload and c["code"] in existing_by_code:
                # UPDATE existing course (preserve ID)
                course_id = existing_by_code[c["code"]]
                cur.execute(
                    """UPDATE courses SET
                       name = %s, division_id = %s, department_id = %s,
                       description = %s, credit_value = %s, duration = %s,
                       grade_levels = %s, credit_type = %s,
                       is_ap = %s, is_dual_credit = %s, is_honors = %s,
                       gpa_waiver = %s, semesters_offered = %s, notes = %s,
                       is_active = TRUE, updated_at = %s
                     WHERE id = %s""",
                    (
                        c["name"], div_id, dept_id,
                        c.get("description", ""), c["credit_value"], c["duration"],
                        c["grade_levels"], c["credit_type"],
                        c.get("is_ap", False), c.get("is_dual_credit", False),
                        c.get("credit_type") == "Honors",
                        c.get("gpa_waiver", False),
                        c.get("semesters_offered"),
                        c.get("notes"), now, course_id,
                    ),
                )
                course_ids[c["code"]] = course_id
            else:
                # INSERT new course
                cur.execute(
                    """INSERT INTO courses
                       (code, name, division_id, department_id, catalog_version_id,
                        description, credit_value, duration, grade_levels,
                        credit_type, is_ap, is_dual_credit, is_honors, gpa_waiver,
                        semesters_offered, notes, is_active, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s)
                       RETURNING id""",
                    (
                        c["code"], c["name"], div_id, dept_id, version_id,
                        c.get("description", ""), c["credit_value"], c["duration"],
                        c["grade_levels"], c["credit_type"],
                        c.get("is_ap", False), c.get("is_dual_credit", False),
                        c.get("credit_type") == "Honors",
                        c.get("gpa_waiver", False),
                        c.get("semesters_offered"),
                        c.get("notes"), now, now,
                    ),
                )
                course_ids[c["code"]] = cur.fetchone()[0]

        # Deactivate stale courses (in DB but not in new JSON)
        if not force_reload:
            stale_codes = set(existing_by_code.keys()) - new_codes
            if stale_codes:
                stale_ids = [existing_by_code[code] for code in stale_codes]
                cur.execute(
                    "UPDATE courses SET is_active = FALSE, updated_at = %s WHERE id = ANY(%s::uuid[])",
                    (now, stale_ids),
                )
                print(f"  Deactivated {len(stale_ids)} stale courses")

        # 5. Insert course_prerequisites (with requirement_group support)
        # Always delete and re-insert prereqs (they may change between catalog versions)
        if not force_reload:
            cur.execute("DELETE FROM course_prerequisites WHERE catalog_version_id = %s", (version_id,))
        prereq_count = 0

        def resolve_code(code):
            """Resolve a course code to its DB id, handling composite codes."""
            cid = course_ids.get(code)
            if cid:
                return cid
            for composite in course_ids:
                if "/" in composite and code in composite.split("/"):
                    return course_ids[composite]
            return None

        for c in courses:
            course_id = course_ids[c["code"]]
            groups = c.get("prerequisite_groups", [])

            if groups:
                # Use structured groups (proper requirement_group assignment)
                for group_info in groups:
                    group_num = group_info["group"]
                    for prereq_code in group_info["codes"]:
                        prereq_id = resolve_code(prereq_code)
                        if prereq_id and course_id != prereq_id:
                            cur.execute(
                                """INSERT INTO course_prerequisites
                                   (course_id, prerequisite_id, relationship_type, requirement_group, catalog_version_id)
                                   VALUES (%s, %s, 'prerequisite', %s, %s)
                                   ON CONFLICT (course_id, prerequisite_id, catalog_version_id) DO NOTHING""",
                                (course_id, prereq_id, group_num, version_id),
                            )
                            prereq_count += 1
            else:
                # Fallback: flat prerequisite_codes, all in group 1
                for prereq_code in c.get("prerequisite_codes", []):
                    prereq_id = resolve_code(prereq_code)
                    if prereq_id and course_id != prereq_id:
                        cur.execute(
                            """INSERT INTO course_prerequisites
                               (course_id, prerequisite_id, relationship_type, requirement_group, catalog_version_id)
                               VALUES (%s, %s, 'prerequisite', 1, %s)
                               ON CONFLICT (course_id, prerequisite_id, catalog_version_id) DO NOTHING""",
                            (course_id, prereq_id, version_id),
                        )
                        prereq_count += 1

        print(f"  Inserted {len(courses)} courses, {prereq_count} prerequisite links")

        conn.commit()
        print("  Transaction committed.")

    except Exception as e:
        conn.rollback()
        print(f"  ERROR: {e}", file=sys.stderr)
        print("  Transaction rolled back.", file=sys.stderr)
        raise
    finally:
        cur.close()


def rollback_catalog(conn):
    """Revert to the previous catalog version."""
    cur = conn.cursor()

    try:
        # Find the latest version by loaded_at
        cur.execute(
            "SELECT id FROM course_catalog_versions ORDER BY loaded_at DESC LIMIT 1"
        )
        latest = cur.fetchone()
        if not latest:
            print("No catalog version found.")
            return

        latest_id = latest[0]

        # Find the previous version
        cur.execute(
            """SELECT id FROM course_catalog_versions
               WHERE id != %s
               ORDER BY loaded_at DESC LIMIT 1""",
            (latest_id,),
        )
        previous = cur.fetchone()
        if not previous:
            print("No previous catalog version to rollback to.")
            return

        previous_id = previous[0]

        # Deactivate latest version's courses
        cur.execute(
            "UPDATE courses SET is_active = FALSE WHERE catalog_version_id = %s",
            (latest_id,),
        )

        # Reactivate previous version's courses
        cur.execute(
            "UPDATE courses SET is_active = TRUE WHERE catalog_version_id = %s",
            (previous_id,),
        )

        conn.commit()
        print(f"Rolled back from version {latest_id} to {previous_id}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR during rollback: {e}", file=sys.stderr)
        raise


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Load courses.json into the PostgreSQL database"
    )
    parser.add_argument("json_path", help="Path to courses.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show diff without writing to DB")
    parser.add_argument("--force", action="store_true",
                        help="Override course count validation")
    parser.add_argument("--rollback", action="store_true",
                        help="Revert to the previous catalog version")
    parser.add_argument("--force-reload", action="store_true",
                        help="Delete all courses and re-insert with new IDs "
                             "(old behavior; breaks foreign key references)")
    args = parser.parse_args()

    # Handle rollback
    if args.rollback:
        conn = get_connection()
        try:
            rollback_catalog(conn)
        finally:
            conn.close()
        return

    # Load courses.json
    json_path = args.json_path
    if not os.path.isfile(json_path):
        print(f"ERROR: JSON file not found: {json_path}", file=sys.stderr)
        sys.exit(1)

    with open(json_path) as f:
        courses_data = json.load(f)

    courses = courses_data["courses"]
    print(f"Loaded {len(courses)} courses from {json_path}")
    print(f"Catalog year: {courses_data['catalog_year']}")
    print()

    # --- Topological sort (cycle detection) ---
    print("Running prerequisite graph validation...")
    sorted_codes, cycles = topological_sort(courses)
    if cycles:
        print("FATAL: Prerequisite cycles detected! Aborting.")
        for cycle in cycles[:10]:
            print(f"  Cycle: {' -> '.join(cycle)}")
        sys.exit(1)
    print(f"  DAG is valid ({len(sorted_codes)} nodes, no cycles)")
    print()

    # --- Diff against existing DB ---
    if not args.dry_run:
        conn = get_connection()
    else:
        conn = None

    existing_courses = {}
    if conn:
        try:
            existing_courses = fetch_existing_courses(conn)
        except Exception as e:
            print(f"Note: Could not fetch existing courses: {e}")

    new_courses_map = {c["code"]: c for c in courses}
    diff = compute_diff(existing_courses, new_courses_map)

    # --- Course count validation ---
    if existing_courses and not args.force:
        old_count = len(existing_courses)
        new_count = len(courses)
        pct_change = abs(new_count - old_count) / old_count * 100 if old_count else 0
        if pct_change > 20:
            print(
                f"ABORT: Course count changed by {pct_change:.1f}% "
                f"({old_count} -> {new_count}). "
                f"Use --force to override."
            )
            sys.exit(1)

    # --- Print diff summary ---
    print("Diff summary:")
    print(f"  Added:     {diff['counts']['added']}")
    print(f"  Removed:   {diff['counts']['removed']}")
    print(f"  Modified:  {diff['counts']['modified']}")
    print(f"  Unchanged: {diff['counts']['unchanged']}")
    print()

    if diff["counts"]["added"] > 0:
        print(f"  New courses: {', '.join(diff['added'][:20])}")
        if len(diff["added"]) > 20:
            print(f"    ... and {len(diff['added']) - 20} more")
    if diff["counts"]["removed"] > 0:
        print(f"  Removed courses: {', '.join(diff['removed'][:20])}")
    if diff["counts"]["modified"] > 0:
        print(f"  Modified courses:")
        for mod in diff["modified"][:10]:
            changes = ", ".join(mod["changes"].keys())
            print(f"    {mod['code']}: {changes}")
    print()

    # --- Dry run stops here ---
    if args.dry_run:
        print("[DRY RUN] No changes written to database.")
        return

    # --- Load into DB ---
    print("Loading into database...")
    try:
        load_courses(conn, courses_data, diff, args.force, force_reload=args.force_reload)
    finally:
        if conn:
            conn.close()

    print()
    print("=" * 60)
    print("LOAD COMPLETE")
    print("=" * 60)
    print(f"  Courses added:    {diff['counts']['added']}")
    print(f"  Courses removed:  {diff['counts']['removed']}")
    print(f"  Courses modified: {diff['counts']['modified']}")


if __name__ == "__main__":
    main()
