"""
Tests for the course catalog extractor.

These tests validate the JSON output schema, required fields, and data
constraints against the actual extracted data (if available) or against
synthetic test data.

Run with:
    python -m pytest tests/test_extract.py -v
"""

import json
import os

import pytest

# Path to the actual extracted data (produced by running extract.py)
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COURSES_JSON = os.path.join(DATA_DIR, "2026-courses.json")
REPORT_JSON = os.path.join(DATA_DIR, "2026-extraction-report.json")
SUMMER_COURSES_JSON = os.path.join(DATA_DIR, "2026-summer-courses.json")

REQUIRED_COURSE_FIELDS = [
    "code", "name", "division", "department", "description",
    "credit_value", "duration", "grade_levels", "credit_type",
    "prerequisites", "prerequisite_codes", "corequisites",
    "is_ap", "is_dual_credit", "notes",
]

REQUIRED_TOP_LEVEL_FIELDS = [
    "catalog_year", "school", "extracted_at", "total_courses", "courses",
]

VALID_GRADE_LEVELS = {9, 10, 11, 12}
VALID_CREDIT_TYPES = {"CP", "Accelerated", "Honors", "AP", "Pass/Fail"}
VALID_DURATIONS = {"semester", "full_year"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def courses_data():
    """Load the courses.json file."""
    if not os.path.isfile(COURSES_JSON):
        pytest.skip(f"Courses JSON not found at {COURSES_JSON}. Run extract.py first.")
    with open(COURSES_JSON) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def courses(courses_data):
    """Return just the courses list."""
    return courses_data["courses"]


@pytest.fixture(scope="module")
def report_data():
    """Load the extraction report."""
    if not os.path.isfile(REPORT_JSON):
        pytest.skip(f"Report JSON not found at {REPORT_JSON}. Run extract.py first.")
    with open(REPORT_JSON) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Top-level schema tests
# ---------------------------------------------------------------------------

class TestTopLevelSchema:
    def test_top_level_fields_present(self, courses_data):
        for field in REQUIRED_TOP_LEVEL_FIELDS:
            assert field in courses_data, f"Missing top-level field: {field}"

    def test_catalog_year_is_integer(self, courses_data):
        assert isinstance(courses_data["catalog_year"], int)

    def test_school_name(self, courses_data):
        assert "Stevenson" in courses_data["school"]

    def test_total_courses_matches(self, courses_data):
        assert courses_data["total_courses"] == len(courses_data["courses"])

    def test_courses_is_list(self, courses_data):
        assert isinstance(courses_data["courses"], list)

    def test_reasonable_course_count(self, courses_data):
        """Stevenson offers roughly 200-400 courses."""
        count = courses_data["total_courses"]
        assert 100 < count < 500, f"Unexpected course count: {count}"


# ---------------------------------------------------------------------------
# Course schema tests
# ---------------------------------------------------------------------------

class TestCourseSchema:
    def test_all_required_fields_present(self, courses):
        for course in courses:
            for field in REQUIRED_COURSE_FIELDS:
                assert field in course, (
                    f"Course {course.get('code', '???')} missing field: {field}"
                )

    def test_code_is_nonempty_string(self, courses):
        for course in courses:
            assert isinstance(course["code"], str)
            assert len(course["code"]) >= 3, (
                f"Course code too short: {course['code']}"
            )

    def test_name_is_nonempty_string(self, courses):
        for course in courses:
            assert isinstance(course["name"], str)
            assert len(course["name"]) > 0, (
                f"Course {course['code']} has empty name"
            )

    def test_no_fallback_names(self, courses):
        """No course should have a 'Course XXX' fallback name."""
        for course in courses:
            assert not course["name"].startswith("Course "), (
                f"Course {course['code']} has fallback name: {course['name']}"
            )

    def test_division_is_nonempty(self, courses):
        for course in courses:
            assert course["division"], f"Course {course['code']} has empty division"

    def test_no_unknown_division(self, courses):
        for course in courses:
            assert course["division"] != "Unknown", (
                f"Course {course['code']} has Unknown division"
            )


# ---------------------------------------------------------------------------
# Grade level tests
# ---------------------------------------------------------------------------

class TestGradeLevels:
    def test_grade_levels_is_list(self, courses):
        for course in courses:
            assert isinstance(course["grade_levels"], list), (
                f"Course {course['code']}: grade_levels is not a list"
            )

    def test_grade_levels_not_empty(self, courses):
        for course in courses:
            assert len(course["grade_levels"]) > 0, (
                f"Course {course['code']}: grade_levels is empty"
            )

    def test_grade_levels_only_valid_values(self, courses):
        for course in courses:
            for g in course["grade_levels"]:
                assert g in VALID_GRADE_LEVELS, (
                    f"Course {course['code']}: invalid grade level {g}"
                )

    def test_grade_levels_sorted(self, courses):
        for course in courses:
            gl = course["grade_levels"]
            assert gl == sorted(gl), (
                f"Course {course['code']}: grade_levels not sorted: {gl}"
            )

    def test_grade_levels_no_duplicates(self, courses):
        for course in courses:
            gl = course["grade_levels"]
            assert len(gl) == len(set(gl)), (
                f"Course {course['code']}: duplicate grade levels: {gl}"
            )


# ---------------------------------------------------------------------------
# Credit and duration tests
# ---------------------------------------------------------------------------

class TestCreditAndDuration:
    def test_credit_value_in_range(self, courses):
        for course in courses:
            cv = course["credit_value"]
            assert 0.25 <= cv <= 2.0, (
                f"Course {course['code']}: credit_value {cv} out of range"
            )

    def test_credit_type_valid(self, courses):
        for course in courses:
            assert course["credit_type"] in VALID_CREDIT_TYPES, (
                f"Course {course['code']}: invalid credit_type {course['credit_type']}"
            )

    def test_duration_valid(self, courses):
        for course in courses:
            assert course["duration"] in VALID_DURATIONS, (
                f"Course {course['code']}: invalid duration {course['duration']}"
            )

    def test_full_year_credit_value(self, courses):
        """Full-year courses should have credit_value 1.0."""
        for course in courses:
            if course["duration"] == "full_year":
                assert course["credit_value"] == 1.0, (
                    f"Course {course['code']}: full_year but credit_value "
                    f"is {course['credit_value']}"
                )

    def test_semester_credit_value(self, courses):
        """Semester courses should have credit_value 0.5."""
        for course in courses:
            if course["duration"] == "semester":
                assert course["credit_value"] == 0.5, (
                    f"Course {course['code']}: semester but credit_value "
                    f"is {course['credit_value']}"
                )


# ---------------------------------------------------------------------------
# AP and classification tests
# ---------------------------------------------------------------------------

class TestClassification:
    def test_ap_courses_have_ap_credit_type(self, courses):
        for course in courses:
            if course["is_ap"]:
                assert course["credit_type"] == "AP", (
                    f"Course {course['code']}: is_ap=True but "
                    f"credit_type={course['credit_type']}"
                )

    def test_is_ap_is_boolean(self, courses):
        for course in courses:
            assert isinstance(course["is_ap"], bool)

    def test_is_dual_credit_is_boolean(self, courses):
        for course in courses:
            assert isinstance(course["is_dual_credit"], bool)


# ---------------------------------------------------------------------------
# Uniqueness tests
# ---------------------------------------------------------------------------

class TestUniqueness:
    def test_no_duplicate_codes(self, courses):
        codes = [c["code"] for c in courses]
        duplicates = [code for code in codes if codes.count(code) > 1]
        assert not duplicates, f"Duplicate course codes found: {set(duplicates)}"


# ---------------------------------------------------------------------------
# Prerequisites tests
# ---------------------------------------------------------------------------

class TestPrerequisites:
    def test_prerequisite_codes_is_list(self, courses):
        for course in courses:
            assert isinstance(course["prerequisite_codes"], list), (
                f"Course {course['code']}: prerequisite_codes is not a list"
            )

    def test_prerequisites_is_string_or_none(self, courses):
        for course in courses:
            p = course["prerequisites"]
            assert p is None or isinstance(p, str), (
                f"Course {course['code']}: prerequisites should be str or None"
            )


# ---------------------------------------------------------------------------
# Report tests
# ---------------------------------------------------------------------------

class TestExtractionReport:
    def test_report_has_required_fields(self, report_data):
        required = [
            "catalog_year", "total_courses", "validation_passed",
            "validation_errors", "warnings", "stats",
        ]
        for field in required:
            assert field in report_data, f"Report missing field: {field}"

    def test_report_validation_passed(self, report_data):
        assert report_data["validation_passed"] is True, (
            f"Validation failed: {report_data['validation_errors']}"
        )

    def test_report_stats_present(self, report_data):
        stats = report_data["stats"]
        assert "by_division" in stats
        assert "by_credit_type" in stats
        assert "ap_courses" in stats


# ---------------------------------------------------------------------------
# Smoke test: specific known courses
# ---------------------------------------------------------------------------

class TestKnownCourses:
    """Sanity checks for a few well-known courses."""

    def _find(self, courses, code):
        matches = [c for c in courses if c["code"] == code]
        return matches[0] if matches else None

    def test_algebra_1_exists(self, courses):
        c = self._find(courses, "MTH151/MTH152")
        assert c is not None, "Algebra 1 (MTH151/MTH152) not found"
        assert "Algebra" in c["name"]
        assert c["duration"] == "full_year"
        assert 9 in c["grade_levels"]

    def test_ap_biology_exists(self, courses):
        c = self._find(courses, "SCI631/SCI632")
        assert c is not None, "AP Biology (SCI631/SCI632) not found"
        assert c["is_ap"] is True
        assert c["credit_type"] == "AP"

    def test_personal_finance_exists(self, courses):
        matches = [c for c in courses if "personal finance" in c["name"].lower()
                   and "online" not in c["name"].lower()]
        assert len(matches) > 0, "Personal Finance not found"
        pf = matches[0]
        assert pf["division"] == "Applied Arts"

    def test_spanish_1_exists(self, courses):
        c = self._find(courses, "SPA101/SPA102")
        assert c is not None, "Spanish 1 (SPA101/SPA102) not found"
        assert "spanish" in c["name"].lower()
        assert c["duration"] == "full_year"


# ---------------------------------------------------------------------------
# Regression: format-mismatch gaps fixed in this PR
# ---------------------------------------------------------------------------

class TestFormatMismatchGaps:
    """Courses whose source format previously slipped past the extractor."""

    def _find(self, courses, code):
        return next((c for c in courses if c["code"] == code), None)

    def test_choice_pe_early_bird_present(self, courses):
        # Page 87 line: "PED031 (early bird)–Semester 1  PED032 (early bird)–Semester 2"
        # The `(early bird)` annotation between code and dash used to break the regex.
        for code in ("PED031", "PED032"):
            assert self._find(courses, code) is not None, (
                f"Choice P.E. Early Bird ({code}) missing — regex did not handle "
                "the parenthetical annotation between code and dash"
            )

    def test_intermediate_mandarin_present(self, courses):
        # Page 78 uses "CHI351-SEMESTER 1  CHI352-SEMESTER 2" (uppercase SEMESTER).
        c = self._find(courses, "CHI351/CHI352")
        assert c is not None, (
            "Intermediate Mandarin (CHI351/CHI352) missing — regex was "
            "case-sensitive on the literal 'Semester'"
        )

    def test_intermediate_spanish_present(self, courses):
        # Same uppercase-SEMESTER format on page 80.
        c = self._find(courses, "SPA351/SPA352")
        assert c is not None, "Intermediate Spanish (SPA351/SPA352) missing"

    def test_voc_courses_loaded(self, courses):
        # Page 26 uses a compact "Name VOC###/###" format with no Semester keyword;
        # a dedicated parser pulls them from the right column of that page.
        voc = [c for c in courses if c["code"].startswith("VOC")]
        assert len(voc) >= 25, (
            f"Expected ~26 Lake County Tech Campus (VOC) course pairs, got {len(voc)}"
        )

    def test_voc_courses_have_section_defaults(self, courses):
        for course in courses:
            if not course["code"].startswith("VOC"):
                continue
            assert course["division"] == "Applied Arts"
            assert course["department"] == "Lake County Tech Campus"
            assert course["duration"] == "full_year"
            assert course["credit_type"] == "CP"
            assert course["grade_levels"] == [11, 12]
            assert course["is_dual_credit"] is True

    def test_voc_specific_course_present(self, courses):
        c = self._find(courses, "VOC591/VOC592")
        assert c is not None, "Cosmetology 1 (VOC591/VOC592) missing"
        assert "cosmetology" in c["name"].lower()


# ---------------------------------------------------------------------------
# Regex unit tests for SEMESTER_LINE_RE
# ---------------------------------------------------------------------------

class TestSemesterLineRegex:
    """Direct regex coverage so future edits don't regress these fixes."""

    @pytest.fixture(scope="module")
    def regex(self):
        from extract import SEMESTER_LINE_RE
        return SEMESTER_LINE_RE

    def test_matches_standard_two_code_line(self, regex):
        m = regex.search("BUS411–Semester 1 BUS412–Semester 2")
        assert m is not None
        assert m.group(1) == "BUS411"
        assert m.group(2) == "BUS412"

    def test_matches_uppercase_semester(self, regex):
        # CHI/SPA Intermediate sections use ALL-CAPS "SEMESTER".
        m = regex.search("CHI351-SEMESTER 1 CHI352-SEMESTER 2")
        assert m is not None
        assert m.group(1) == "CHI351"
        assert m.group(2) == "CHI352"

    def test_matches_parenthetical_annotation(self, regex):
        # PED031 line has "(early bird)" between the code and the dash.
        m = regex.search("PED031 (early bird)–Semester 1 PED032 (early bird)–Semester 2")
        assert m is not None
        assert m.group(1) == "PED031"
        assert m.group(2) == "PED032"

    def test_matches_only_suffix(self, regex):
        m = regex.search("BUS252–Semester 2 Only")
        assert m is not None
        assert m.group(1) == "BUS252"

    def test_matches_uppercase_only_suffix(self, regex):
        m = regex.search("PED501–SEMESTER 1 ONLY")
        assert m is not None


# ---------------------------------------------------------------------------
# Regression: next-block bleed (issue #145)
# ---------------------------------------------------------------------------

class TestNextBlockBoundary:
    """Direct unit coverage for `find_next_block_boundary`.

    The previous extractor let the next course's title and decorator tags
    bleed into the current course's description, notes, and gpa_waiver /
    is_dual_credit flags. The boundary helper truncates `below_lines` at
    the next course's header preamble.
    """

    @pytest.fixture(scope="module")
    def boundary(self):
        from extract import find_next_block_boundary
        return find_next_block_boundary

    def test_strips_trailing_title_tag_and_column_bleed(self, boundary):
        # ART101 layout (page 48): description ends, then column-bleed scraps
        # "G" / "Op" / "Pr" surround the next course's title "DRAWING AR" and
        # tag "GPA WAIVER OPTION Pr" before the next code line ART221.
        below = [
            "This course serves as a prerequisite for all advanced art classes.",
            "G",
            "DRAWING AR",
            "Op",
            "GPA WAIVER OPTION Pr",
        ]
        next_code = "ART221–Semester 1 ART222–Semester 2"
        b = boundary(below, next_code)
        assert b == 1, f"boundary should strip everything after the description (got {b})"
        assert below[:b] == [
            "This course serves as a prerequisite for all advanced art classes.",
        ]

    def test_strips_next_course_gpa_waiver_tag(self, boundary):
        # BUS411 had `gpa_waiver: true` because the *next* course (BUS251 /
        # Accounting 1) has "GPA WAIVER OPTION" above its code line. The
        # boundary must cut before that tag so the flag isn't mis-attributed.
        below = [
            "preparing the finances of their business plan.",
            "GPA WAIVER OPTION",
        ]
        next_code = "BUS251–Semester 1 Only"
        b = boundary(below, next_code)
        assert b == 1
        assert "GPA WAIVER OPTION" not in " ".join(below[:b])

    def test_excludes_metadata_header_from_title_match(self, boundary):
        # The CHI/SPA Intermediate sections use uppercase metadata
        # ("OPEN TO: 9-10-11-12 FULL YEAR"). Without a metadata exclusion the
        # heuristic would mistake this for a course title and truncate the
        # description — and lose the "FULL YEAR" duration signal.
        below = [
            "OPEN TO: 9-10-11-12 FULL YEAR",
            "Prerequisite: ...",
            "Credit: Accelerated",
            "Description body text continues normally.",
        ]
        b = boundary(below, "CHI411–Semester 1 CHI412–Semester 2")
        assert b == len(below), (
            "OPEN TO: ... FULL YEAR is metadata, not a course title — should "
            f"not trigger the boundary (got {b})"
        )

    def test_does_not_match_real_course_title_as_footer(self, boundary):
        # Page footer "64 MATHEMATICS" must be detected, but the regex must
        # NOT match real course titles like "MANDARIN CHINESE 4" (single digit
        # level number, no em-dash) — a previous version of the regex did.
        from extract import PAGE_FOOTER_RE
        assert PAGE_FOOTER_RE.match("64 MATHEMATICS")
        assert PAGE_FOOTER_RE.match("46 FINE ARTS—VISUAL ARTS")
        assert PAGE_FOOTER_RE.match("MULTILINGUAL LEARNING—LANGUAGE LEARNING 71")
        assert not PAGE_FOOTER_RE.match("MANDARIN CHINESE 4"), (
            "MANDARIN CHINESE 4 is a real course title, not a page footer"
        )

    def test_no_boundary_when_description_ends_cleanly(self, boundary):
        below = [
            "This course is the second semester of a two-semester sequence.",
            "Specialized journal systems and inventory controls are emphasized.",
        ]
        # next_code_line is also irrelevant when there's no trailing header.
        b = boundary(below, "BUS361–Semester 1 BUS362–Semester 2")
        assert b == len(below)

    def test_strips_trailing_column_bleed_when_last_in_column(self, boundary):
        # MTH151 is the last code in its column on page 66. Without a next
        # code line, the trailing 1-3 char column-bleed scraps must still be
        # stripped so the description doesn't end with garbage like
        # "co Al op co MT Op Pr G ou be to de an ex ex AB (M".
        below = [
            "demonstrated proficiency in all the course skills of Algebra 1.",
            "co",
            "Al",
            "op",
            "(M",
            "64 MATHEMATICS",
        ]
        b = boundary(below, None)
        assert b == 1, f"trailing scraps + page footer should be stripped (got {b})"
        assert below[:b] == [
            "demonstrated proficiency in all the course skills of Algebra 1.",
        ]


class TestNextBlockBleedFixedInJson:
    """Whole-pipeline assertions against the freshly-extracted catalog.

    These guard the JSON consumed by the loader, so future regressions are
    caught against the data the modal actually displays.
    """

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_bus411_has_no_gpa_waiver(self, by_code):
        # BUS411 has no "GPA WAIVER OPTION" in the PDF — the tag belongs to
        # the next course (BUS251). Mis-attribution showed up as
        # gpa_waiver=True / notes="GPA waiver option available".
        c = by_code.get("BUS411")
        assert c is not None
        assert c["gpa_waiver"] is False, (
            "BUS411 has no GPA waiver per PDF — the tag was bleeding from BUS251"
        )

    def test_chi351_is_not_dual_credit(self, by_code):
        # The "DUAL CREDIT AVAILABLE WITH NORTH CENTRAL COLLEGE" tag on
        # page 78 belongs to CHI411 (Mandarin 4), not CHI351 (Intermediate
        # Mandarin). The bleed previously mis-flagged CHI351.
        c = by_code.get("CHI351/CHI352")
        assert c is not None
        assert c["is_dual_credit"] is False, (
            "CHI351 is not dual credit — the tag belongs to CHI411 below it"
        )

    def test_chi411_is_dual_credit(self, by_code):
        # The mirror of the above: CHI411 *should* have the dual credit flag.
        c = by_code.get("CHI411/CHI412")
        assert c is not None
        assert c["is_dual_credit"] is True

    def test_descriptions_dont_end_in_next_course_titles(self, by_code):
        # Spot-check: the most blatant bleed cases from the audit. Each
        # description should NOT end with the next course's title text.
        bleed_pairs = {
            "ART101": "DRAWING",
            "CHI601/CHI602": "CHINESE LITERATURE",
            "CSC371/CSC372": "COMPUTER SCIENCE ALGORITHMS",
            "BUS252": "ADVANCED ACCOUNTING",
            "MTH591": "COLLEGE LINEAR ALGEBRA",
            "SOC101/SOC102": "CONSTITUTIONAL LAW",
            "ENG141/ENG142": "ENGLISH 9: THREADS",
            "PED031": "PHYSICAL EDUCATION LEADERSHIP TRAINING",
        }
        for code, bleed in bleed_pairs.items():
            c = by_code.get(code)
            assert c is not None, f"{code} missing from extraction"
            assert bleed not in c["description"], (
                f"{code} description still contains next-course bleed: {bleed!r}"
            )


# ---------------------------------------------------------------------------
# Summer course tests
# ---------------------------------------------------------------------------

REQUIRED_SUMMER_FIELDS = [
    "code", "name", "division", "department", "credit_value",
    "duration", "credit_type", "grade_levels", "semesters_offered",
    "is_summer",
]


@pytest.fixture(scope="module")
def summer_data():
    """Load the summer courses JSON file."""
    if not os.path.isfile(SUMMER_COURSES_JSON):
        pytest.skip(f"Summer courses JSON not found at {SUMMER_COURSES_JSON}. Run extract_summer.py first.")
    with open(SUMMER_COURSES_JSON) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def summer_courses(summer_data):
    """Return just the summer courses list."""
    return summer_data["courses"]


class TestSummerCourseSchema:
    def test_summer_json_exists(self):
        assert os.path.isfile(SUMMER_COURSES_JSON), (
            f"Summer courses JSON not found at {SUMMER_COURSES_JSON}"
        )

    def test_required_fields_present(self, summer_courses):
        for course in summer_courses:
            for field in REQUIRED_SUMMER_FIELDS:
                assert field in course, (
                    f"Summer course {course.get('code', '???')} missing field: {field}"
                )

    def test_credit_value_allows_zero(self, summer_courses):
        """credit_value should allow 0.0 for non-credit courses like ACT Prep."""
        for course in summer_courses:
            cv = course["credit_value"]
            assert 0.0 <= cv <= 2.0, (
                f"Summer course {course['code']}: credit_value {cv} out of range"
            )

    def test_has_zero_credit_course(self, summer_courses):
        """At least one summer course (e.g. ACT Prep) should have 0.0 credits."""
        zero_credit = [c for c in summer_courses if c["credit_value"] == 0.0]
        assert len(zero_credit) > 0, "Expected at least one 0-credit summer course"

    def test_is_summer_flag(self, summer_courses):
        for course in summer_courses:
            assert course["is_summer"] is True, (
                f"Summer course {course['code']}: is_summer should be True"
            )

    def test_code_is_nonempty(self, summer_courses):
        for course in summer_courses:
            assert isinstance(course["code"], str) and len(course["code"]) >= 3

    def test_grade_levels_valid(self, summer_courses):
        for course in summer_courses:
            for g in course["grade_levels"]:
                assert g in VALID_GRADE_LEVELS, (
                    f"Summer course {course['code']}: invalid grade level {g}"
                )
