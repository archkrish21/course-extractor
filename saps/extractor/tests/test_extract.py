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


class TestPrereqBleedIntoDescription:
    """Direct unit coverage for `extract_description` (issue #144).

    Multi-line prerequisite blocks were leaking their tail into the start
    of the course description, and a wrapped description line beginning
    with the word "prerequisite" was being mis-classified as a metadata
    header and skipped entirely.
    """

    @pytest.fixture(scope="module")
    def extract_desc(self):
        from extract import extract_description
        return extract_description

    def test_does_not_skip_wrapped_description_starting_with_prerequisite(self, extract_desc):
        # ART101 PDF wraps its closing sentence:
        #   "...This course serves as
        #    prerequisite for all advanced art classes."
        # The lower-cased wrapped line begins with "prerequisite" but is
        # NOT a metadata header (no colon). The previous heuristic
        # silently dropped it.
        below = [
            "Open to: 9-10-11-12 One Semester",
            "Prerequisite: None credit: College prep",
            "This foundational course introduces students to essential",
            "techniques, tools and media across the visual arts.",
            "This course serves as",
            "prerequisite for all advanced art classes.",
        ]
        desc = extract_desc(below)
        assert "prerequisite for all advanced art classes." in desc

    def test_skips_wrapped_prereq_continuation(self, extract_desc):
        # PED031 layout: a two-line prereq, separate Credit: line, then
        # description. The second prereq line ("education class or
        # director approval") used to bleed into the start of the description.
        below = [
            "Open to: 10-11-12 One Semester",
            "Prerequisite: A Foundational Fitness course, any physical",
            "education class or director approval",
            "Credit: College prep",
            "(See description for Choice P.E.). Early Bird Physical Education",
            "is scheduled from 7-8:25 a.m. on Monday/Wednesday/Friday.",
        ]
        desc = extract_desc(below)
        assert "education class or director approval" not in desc
        assert desc.startswith("(See description for Choice P.E.).")

    def test_handles_inline_credit_after_prerequisite(self, extract_desc):
        # ART101 layout puts both prereq and credit on one line:
        #   "Prerequisite: None credit: College prep"
        # The fix recognises that the prereq block is self-contained on
        # this line and doesn't swallow the next paragraph as continuation.
        below = [
            "Open to: 9-10-11-12 One Semester",
            "Prerequisite: None credit: College prep",
            "This foundational course introduces students to essential",
            "techniques, tools and media across the visual arts.",
        ]
        desc = extract_desc(below)
        assert desc.startswith("This foundational course")

    def test_skips_bullet_list_prereq_block(self, extract_desc):
        # BUS411 has a bullet-list prereq block spanning many lines.
        below = [
            "Open to: 11-12 One Semester",
            "Prerequisite:",
            "One course required from: and One course required from:",
            "■ Introduction to Business ■ Investment Management",
            "■ Business Law ■ Accounting 1",
            "■ Marketing ■ Accounting 2 Honors",
            "■ Entrepreneurship ■ Advanced Accounting Honors",
            "Credit: Accelerated",
            "Entrepreneurial Tactics is a capstone course that ties together",
            "all the curricular fundamentals from the Business Education curriculum.",
        ]
        desc = extract_desc(below)
        assert "■" not in desc
        assert "required from" not in desc
        assert desc.startswith("Entrepreneurial Tactics is a capstone course")


class TestNoteBlockBleedIntoDescription:
    """A multi-line "Note:" header (e.g. ART401's "Note: Students may use
    their own DSLR; however, students may / check out school-owned
    cameras for assignments.") used to bleed its wrapped continuation
    into the start of the description.

    The cropped column text doesn't preserve blank-line separators, so
    the fix detects the description-paragraph boundary heuristically:
    a line starting with a capital letter immediately after a line
    ending with a sentence-ending period exits the metadata block.
    """

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_art401_starts_with_actual_description(self, by_code):
        c = by_code.get("ART401")
        assert c is not None
        assert c["description"].startswith("This foundational course"), (
            f"ART401 should start with the real description, got "
            f"{c['description'][:80]!r}"
        )
        # The Note: continuation must NOT be in the description.
        assert "check out school-owned cameras" not in c["description"]

    def test_art411_starts_with_actual_description(self, by_code):
        c = by_code.get("ART411")
        assert c is not None
        assert c["description"].startswith("This course is designed to refine"), (
            f"ART411 should start with the real description, got "
            f"{c['description'][:80]!r}"
        )
        assert "however, students may check out" not in c["description"]

    def test_art501_starts_with_actual_description(self, by_code):
        c = by_code.get("ART501")
        assert c is not None
        assert c["description"].startswith("This course is designed to introduce"), (
            f"ART501 should start with the real description, got "
            f"{c['description'][:80]!r}"
        )
        assert "may check out a school-owned" not in c["description"]


class TestPrereqBleedFixedInJson:
    """Whole-pipeline assertions: descriptions should not start with the
    tail of the prerequisite block for any of the audited courses."""

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_ped031_description_starts_correctly(self, by_code):
        c = by_code.get("PED031")
        assert c is not None
        assert c["description"].startswith("(See description for Choice P.E.)."), (
            f"PED031 polluted by prereq tail: {c['description'][:80]!r}"
        )

    def test_chi601_description_starts_with_actual_description(self, by_code):
        c = by_code.get("CHI601/CHI602")
        assert c is not None
        assert c["description"].startswith("This course is designed to prepare"), (
            f"CHI601 polluted: {c['description'][:80]!r}"
        )

    def test_chi351_description_starts_with_actual_description(self, by_code):
        c = by_code.get("CHI351/CHI352")
        assert c is not None
        assert c["description"].startswith("This course is designed specifically"), (
            f"CHI351 polluted: {c['description'][:80]!r}"
        )

    def test_bus411_description_does_not_contain_bullet_list(self, by_code):
        c = by_code.get("BUS411")
        assert c is not None
        assert "■" not in c["description"]
        assert "required from" not in c["description"]
        assert c["description"].startswith("Entrepreneurial Tactics is a capstone course"), (
            f"BUS411 should start with 'Entrepreneurial Tactics is...': {c['description'][:80]!r}"
        )

    def test_art101_description_includes_closing_sentence(self, by_code):
        # The closing sentence wraps to a line beginning with "prerequisite";
        # the previous heuristic dropped it as a fake metadata header.
        c = by_code.get("ART101")
        assert c is not None
        assert "prerequisite for all advanced art classes" in c["description"], (
            "ART101 should include the closing 'prerequisite for all advanced "
            "art classes' sentence — wrapped continuation was being dropped"
        )


class TestPrereqMatcherStrictness:
    """Direct unit coverage for `_names_match_strictly` (issue #146).

    The previous matcher used `frag in stored_name or stored_name in
    frag`, which let a single-word fragment fuzzy-match against any
    course name containing that word — e.g. "culture" matched "Stories,
    Culture and Possibility" (ENG141), so AP Chinese ended up with
    freshman English as a prereq.
    """

    @pytest.fixture(scope="module")
    def matches(self):
        from extract import _names_match_strictly
        return _names_match_strictly

    def test_exact_name_matches(self, matches):
        assert matches("algebra 1", "algebra 1")

    def test_single_word_fragment_does_not_fuzzy_match(self, matches):
        # The CHI601-vs-ENG141 false positive: "culture" alone must NOT
        # match "stories, culture and possibility".
        assert not matches("culture", "stories, culture and possibility")

    def test_intermediate_does_not_fuzzy_match(self, matches):
        # The SPA351-vs-CHI351 false positive: "intermediate" alone must
        # NOT match "intermediate mandarin chinese language arts".
        assert not matches("intermediate", "intermediate mandarin chinese language arts")

    def test_multiword_prefix_match(self, matches):
        # CHI601's prereq mentions "AP Chinese Language and Culture";
        # the stripped fragment "ap chinese language" should still match
        # the full course name as a multi-word substring.
        assert matches("ap chinese language", "ap chinese language and culture")

    def test_multiword_does_not_match_unrelated_course(self, matches):
        # "ap chinese language" must not fuzzy-match an unrelated course.
        assert not matches("ap chinese language", "stories, culture and possibility")

    def test_short_fragment_excluded(self, matches):
        # Fragments shorter than 5 chars are noise.
        assert not matches("ap", "ap calculus bc")

    def test_word_boundary_required(self, matches):
        # The fragment must align on word boundaries — "intermed" inside
        # "intermediate" should not match.
        assert not matches("intermed", "intermediate mandarin chinese")

    def test_dash_acts_as_right_word_boundary(self, matches):
        # Catalog course names often end with "–PLTW" or similar tags. A
        # fragment matching the bare name must still trigger when the
        # stored name follows it with an en-dash (or other punctuation).
        # Without this, "engineering design" matched only the longer
        # "engineering design and development–pltw" (space after) and
        # missed "introduction to engineering design–pltw" (en-dash
        # after) — letting the ambiguity guard upstream wrongly add the
        # capstone TEC401 as a prereq for TEC151's downstream courses.
        assert matches("engineering design", "introduction to engineering design–pltw")
        assert matches("engineering design", "engineering design and development–pltw")


class TestAmbiguousPrereqMatchesAreDropped:
    """Whole-pipeline guard against the prereq-graph cycle that surfaced
    when loading the post-audit JSON into the local DB.

    "Engineering Design" appears in TEC151's full name (Introduction to
    Engineering Design–PLTW) AND TEC401's full name (Engineering Design
    and Development–PLTW). The fragment matched both, so TEC151's
    downstream courses (TEC351, TEC301, TEC291, TEC261) all wrongly
    listed TEC401 as a prereq — and TEC401 lists THEM as prereqs in
    turn, producing cycles like TEC401 → TEC351 → TEC401 that crashed
    the loader's DAG validation.

    The fix: when a multi-word fragment matches more than one stored
    course name, drop the resolution entirely (better no link than the
    wrong link).
    """

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_tec_intro_courses_do_not_list_capstone_as_prereq(self, by_code):
        # The capstone (TEC401/TEC402) requires the intro courses, NOT
        # the other way around. Listing it as a prereq creates cycles.
        for code in ("TEC351/TEC352", "TEC301/TEC302",
                     "TEC291/TEC292", "TEC261/TEC262"):
            c = by_code.get(code)
            assert c is not None, f"{code} missing from extraction"
            assert "TEC401/TEC402" not in c.get("prerequisite_codes", []), (
                f"{code} wrongly lists capstone TEC401/TEC402 as a prereq — "
                f"creates a cycle in the prereq DAG"
            )

    def test_tec_intro_courses_still_list_intro_design(self, by_code):
        # Sanity: the legitimate "Introduction to Engineering Design–PLTW"
        # prereq must still resolve.
        for code in ("TEC351/TEC352", "TEC301/TEC302",
                     "TEC291/TEC292", "TEC261/TEC262"):
            c = by_code.get(code)
            assert c is not None
            assert "TEC151/TEC152" in c.get("prerequisite_codes", []), (
                f"{code} should list TEC151/TEC152 (Intro to Engineering Design)"
            )


class TestPrereqCodesIsUnionOfGroups:
    """Top-level `prerequisite_codes` must equal the union of codes across
    `prerequisite_groups` for every course (issue #147).

    Previously the bullet-list pattern (e.g. BUS411's "One course required
    from: ... and One course required from: ...") populated
    `prerequisite_groups` with all 13 options across two groups while
    leaving `prerequisite_codes` at the 1-2 codes from the simple regex
    pass — so a downstream consumer reading the top-level field saw a
    misleading subset.
    """

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_top_level_equals_group_union_for_all_courses(self, courses):
        for c in courses:
            if not c.get("prerequisite_groups"):
                continue
            top = set(c.get("prerequisite_codes", []) or [])
            union = set()
            for g in c["prerequisite_groups"]:
                union.update(g.get("codes", []))
            assert top == union, (
                f"{c['code']}: top-level prerequisite_codes ({sorted(top)}) "
                f"does not equal union of prerequisite_groups ({sorted(union)})"
            )

    def test_bus411_top_level_lists_all_thirteen_options(self, by_code):
        # Specific example from the audit: BUS411 has two AND'd OR-groups
        # totaling 13 distinct course options. The top-level field must
        # surface all of them.
        c = by_code.get("BUS411")
        assert c is not None
        top = set(c.get("prerequisite_codes", []) or [])
        for code in (
            "BUS171", "BUS172", "BUS371", "BUS372",
            "BUS281", "BUS282", "BUS231", "BUS232",
            "BUS361", "BUS362", "BUS251", "BUS252", "BUS351",
        ):
            assert code in top, (
                f"BUS411 prerequisite_codes missing {code} — should include "
                f"all 13 bullet-list options"
            )


class TestPrereqCodesFixedInJson:
    """Whole-pipeline assertions for the false-positive prereq codes."""

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_chi601_does_not_list_eng141(self, by_code):
        c = by_code.get("CHI601/CHI602")
        assert c is not None
        assert "ENG141/ENG142" not in c.get("prerequisite_codes", []), (
            "AP Chinese should not list freshman English as a prereq — "
            "fuzzy-match on 'culture' was the bug"
        )

    def test_chi601_still_lists_mandarin_4(self, by_code):
        c = by_code.get("CHI601/CHI602")
        assert c is not None
        assert "CHI411/CHI412" in c.get("prerequisite_codes", [])

    def test_spa351_does_not_list_chi351(self, by_code):
        c = by_code.get("SPA351/SPA352")
        assert c is not None
        assert "CHI351/CHI352" not in c.get("prerequisite_codes", []), (
            "Intermediate Spanish should not list Intermediate Mandarin "
            "as a prereq — fuzzy-match on 'intermediate' was the bug"
        )

    def test_chi351_does_not_list_eld361(self, by_code):
        c = by_code.get("CHI351/CHI352")
        assert c is not None
        assert "ELD361/ELD362" not in c.get("prerequisite_codes", [])

    def test_bus411_groups_still_resolve_all_options(self, by_code):
        # BUS411 lists 13 prereq options across two AND'd OR-groups; the
        # bullet-list matcher must still resolve them after the strict
        # tightening.
        c = by_code.get("BUS411")
        assert c is not None
        groups = c.get("prerequisite_groups", [])
        all_codes = {code for g in groups for code in g.get("codes", [])}
        # Each of these is a real Business course referenced in the bullet list.
        for code in ("BUS171", "BUS371", "BUS281", "BUS231", "BUS361", "BUS251", "BUS351"):
            assert code in all_codes, f"BUS411 prereq groups missing {code}"


class TestColumnBleedScrapsRemoved:
    """Whole-pipeline assertions for the column-bleed fix (issue #143).

    Catalog pages have two-column layouts where the gutter location varies
    per page (Math at x≈306, Multilingual at x≈324, etc.). A fixed
    page-midpoint crop with overlap let the next column's narrow word
    fragments leak in as 1-3 character scraps inside descriptions.

    The fix detects the gutter dynamically per page and discards isolated
    short-line scraps after cropping.
    """

    @pytest.fixture(scope="module")
    def by_code(self, courses):
        return {c["code"]: c for c in courses}

    def test_art101_description_has_no_inline_scraps(self, by_code):
        # Pre-fix: "ad This foundational course... w techniques... gl will
        # explore... of through hands-on..."
        c = by_code.get("ART101")
        assert c is not None
        d = c["description"]
        assert d.startswith("This foundational course"), (
            f"ART101 should start cleanly, got {d[:60]!r}"
        )
        for scrap in (" ad ", " gl ", " of through", " w techniques"):
            assert scrap not in d, f"ART101 description still contains scrap: {scrap!r}"

    def test_csc371_description_has_no_inline_scraps(self, by_code):
        # Pre-fix: "AP Computer Science Principles is a college-level Pr De
        # computing course... breadth of (T the computer science field..."
        c = by_code.get("CSC371/CSC372")
        assert c is not None
        d = c["description"]
        for scrap in ("Pr De", "(T the", "Cr computing", "qu exam"):
            assert scrap not in d, f"CSC371 still contains scrap: {scrap!r}"

    def test_soc101_description_has_no_inline_scraps(self, by_code):
        # Pre-fix: "...Social Studies. Th Students taking World History
        # and Geography develop co core academic skills..."
        c = by_code.get("SOC101/SOC102")
        assert c is not None
        d = c["description"]
        for scrap in ("Studies. Th Students", "develop co core", "present. th Patterns"):
            assert scrap not in d, f"SOC101 still contains scrap: {scrap!r}"

    def test_mth151_description_has_no_inline_scraps(self, by_code):
        c = by_code.get("MTH151/MTH152")
        assert c is not None
        d = c["description"]
        # Pre-fix sample: "develop proficiency re in algebraic thinking",
        # "ideas ab of patterns of change"
        for scrap in (" re in algebraic", " ab of patterns", " th mathematical"):
            assert scrap not in d, f"MTH151 still contains scrap: {scrap!r}"

    def test_no_standalone_short_line_scraps(self, by_code):
        # Spot-check a sample of courses across divisions: their descriptions
        # should not contain the standalone-line scrap patterns ("ad",
        # "(M", etc.) joined as " X " between sentences.
        sample = ["ART101", "MTH151/MTH152", "SCI111/SCI112",
                  "CHI601/CHI602", "BUS411", "PED031"]
        for code in sample:
            c = by_code.get(code)
            if not c:
                continue
            # No 1-2 char alpha tokens between two real words (catches " ad ",
            # " gl ", " co " etc. when they're sentence-separated).
            d = c["description"]
            inline_scraps = [m for m in
                             ["ad This", "w techniques", "gl will",
                              "of through", "co core", "th mathematical"]
                             if m in d]
            assert not inline_scraps, (
                f"{code} description still contains scraps: {inline_scraps}"
            )


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


class TestSummerDescriptionsAreVerbatim:
    """Regression for issue #147: summer descriptions must reflect the
    full PDF text, not 1-2 sentence hand-summaries."""

    @pytest.fixture(scope="module")
    def by_code(self, summer_courses):
        return {c["code"]: c for c in summer_courses}

    def test_audited_descriptions_meet_min_length(self, by_code):
        # The audit specifically called out CAR53S and ACTPREPS as
        # 2-3x shorter than the source PDF. The verbatim versions are
        # comfortably above 350 characters.
        for code, min_len in [
            ("CAR53S", 350),
            ("ACTPREPS", 350),
            ("BUS71S", 400),
            ("MTH15S/MTH16S", 700),
            ("D/E21S", 800),
        ]:
            c = by_code.get(code)
            assert c is not None, f"{code} missing from summer JSON"
            assert len(c["description"]) >= min_len, (
                f"{code} description is {len(c['description'])} chars, "
                f"expected ≥{min_len} (verbatim PDF text)"
            )

    def test_car53s_has_marketplace_phrase(self, by_code):
        # PDF: "Business careers continue to be among the most in-demand,
        # diverse and highest paying jobs in today's marketplace."
        c = by_code.get("CAR53S")
        assert c is not None
        assert "in-demand" in c["description"]
        assert "marketplace" in c["description"]

    def test_actpreps_has_test_taking_strategies(self, by_code):
        # PDF mentions test-taking strategies and ACT scoring — the old
        # 2-sentence summary dropped both.
        c = by_code.get("ACTPREPS")
        assert c is not None
        assert "test-taking strategies" in c["description"]
        assert "ACT is scored" in c["description"]


class TestSemesterPairRepresentation:
    """Locks in the canonical pair-representation rule (issue #148):

    - A two-code semester course (e.g. ART AND DESIGN, ART101 sem 1 +
      ART102 sem 2) is stored as **two separate entries**, each with its
      own ``semesters_offered`` value.
    - A two-code full-year course (e.g. AP ART HISTORY, ART721 sem 1 +
      ART722 sem 2) is stored as **one paired entry** with the slashed
      code ``ART721/ART722`` and ``semesters_offered=null``.

    The course-detail modal queries linked courses by name, so the modal
    surfaces partner courses correctly under both representations: split
    entries find each other via the shared name; paired entries don't
    need a partner because both codes are in the same row.

    The audit identified the appearance of "two representations" as an
    inconsistency, but each representation maps exclusively to one
    duration. Mixing them within a single name would be the actual bug.
    """

    @pytest.fixture(scope="module")
    def by_name(self, courses):
        from collections import defaultdict
        result = defaultdict(list)
        for c in courses:
            result[c["name"]].append(c)
        return result

    def test_semester_pairs_are_split(self, by_name):
        for name, entries in by_name.items():
            if len(entries) <= 1:
                continue
            durations = {e["duration"] for e in entries}
            if durations != {"semester"}:
                continue
            for e in entries:
                # D/E codes legitimately contain a "/" inside the prefix.
                assert "/" not in e["code"] or e["code"].startswith("D/E"), (
                    f"Semester course {name!r} has paired code {e['code']!r}; "
                    f"expected split entries (one per semester)"
                )

    def test_no_name_has_mixed_representations(self, by_name):
        # If a name has both a paired entry AND split entries, that's a
        # real inconsistency. The only acceptable case is the same name
        # spanning regular (paired full_year) + summer (split semester).
        for name, entries in by_name.items():
            if len(entries) <= 1:
                continue
            paired = [e for e in entries
                      if "/" in e["code"] and not e["code"].startswith("D/E")]
            split = [e for e in entries
                     if "/" not in e["code"] or e["code"].startswith("D/E")]
            if paired and split:
                paired_durations = {e["duration"] for e in paired}
                split_durations = {e["duration"] for e in split}
                assert paired_durations == {"full_year"} and split_durations == {"semester"}, (
                    f"{name!r} mixes representations within the same duration: "
                    f"paired={[e['code'] for e in paired]} split={[e['code'] for e in split]}"
                )


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
