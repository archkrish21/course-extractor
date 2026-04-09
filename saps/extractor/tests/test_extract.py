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
