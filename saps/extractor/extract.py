#!/usr/bin/env python3
"""
Stevenson High School Course Catalog PDF Extractor

Reads the annual course catalog PDF and produces:
  - data/YYYY-courses.json   (structured course data)
  - data/YYYY-extraction-report.json (extraction metrics and warnings)

Usage:
    python extract.py <path-to-pdf> [--year YYYY] [--out-dir DIR]

The Stevenson coursebook uses a **two-column** layout on most course-detail
pages.  Plain ``extract_text()`` merges left/right columns row-by-row,
interleaving unrelated courses.  This extractor crops each page at the
horizontal midpoint and processes left and right columns independently.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

import pdfplumber

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DIVISION_MAP = {
    "BUS": ("Applied Arts", "Business Education"),
    "D/E": ("Applied Arts", "Driver Education"),
    "FCS": ("Applied Arts", "Family and Consumer Sciences"),
    "VOC": ("Applied Arts", "Lake County Tech Campus"),
    "ENG": ("Communication Arts", "English"),
    "JRN": ("Communication Arts", "Journalism"),
    "CSC": ("Computer Science, Engineering and Technology", "Computer Science"),
    "TEC": ("Computer Science, Engineering and Technology", "Engineering and Technology"),
    "ART": ("Fine Arts", "Visual Arts"),
    "DNC": ("Fine Arts", "Dance"),
    "MUS": ("Fine Arts", "Music"),
    "THR": ("Fine Arts", "Theatre"),
    "MTH": ("Mathematics", "Mathematics"),
    "CHI": ("Multilingual Learning", "Mandarin Chinese"),
    "FRE": ("Multilingual Learning", "French"),
    "GER": ("Multilingual Learning", "German"),
    "GRE": ("Multilingual Learning", "German"),
    "HBR": ("Multilingual Learning", "Hebrew"),
    "LAT": ("Multilingual Learning", "Latin"),
    "SPN": ("Multilingual Learning", "Spanish"),
    "SPA": ("Multilingual Learning", "Spanish"),
    "ELD": ("Multilingual Learning", "English Language Development"),
    "PED": ("Physical Welfare", "Physical Education"),
    "SCI": ("Science", "Science"),
    "SOC": ("Social Studies", "Social Studies"),
}

# Manual name overrides for courses whose names are hard to extract.
# Manual corrections for grade levels that the two-column parser gets wrong
MANUAL_GRADE_OVERRIDES: dict[str, list[int]] = {
    "MUS461": [10, 11, 12],   # AP Music Theory — parser picks up Guitar 2's "Open to: 9-10-11-12"
    "MUS462": [10, 11, 12],
}

MANUAL_NAME_OVERRIDES: dict[str, str] = {
    "BUS142": "Business Applications and Technology 2",
    "BUS252": "Accounting 2",
    "ENG341": "American Studies (AP English Language and Composition and AP U.S. History)",
    "ENG342": "American Studies (AP English Language and Composition and AP U.S. History)",
    "ENG522": "Creative Writing Seminar",
    "SCI63E1": "AP Biology Early Bird",
    "SCI63E2": "AP Biology Early Bird",
    "SCI61E1": "AP Physics 1 Early Bird",
    "SCI61E2": "AP Physics 1 Early Bird",
    "SCI65E1": "AP Chemistry Early Bird",
    "SCI65E2": "AP Chemistry Early Bird",
    "PED031": "Choice P.E. Early Bird",
    "PED032": "Choice P.E. Early Bird",
    "CHI351": "Intermediate Mandarin Chinese Language Arts",
    "CHI352": "Intermediate Mandarin Chinese Language Arts",
    "SPA351": "Intermediate Spanish Language Arts",
    "SPA352": "Intermediate Spanish Language Arts",
    "PED41L": "Alternative Physical Education Leadership",
    "PED42L": "Alternative Physical Education Leadership",
    "PED61L": "Physical Education Leadership",
    "PED62L": "Physical Education Leadership",
    "PED71L": "Pool Leadership Training",
    "PED72L": "Pool Leadership Training",
    "PED81L": "Senior Leadership",
    "PED82L": "Senior Leadership",
    "SOC6Q1": "AP Government–United States—Online",
    "SOC6Q2": "AP Government–United States—Online",
    "BUS3Q1": "Personal Finance—Online",
    "BUS3Q2": "Personal Finance—Online",
    "MTH591": "College Multivariable Calculus",
    "MTH592": "College Linear Algebra",
    "SCI66E1": "AP Environmental Science Early Bird",
    "SCI66E2": "AP Environmental Science Early Bird",
    "BUS301": "Personal Finance",
    "BUS302": "Personal Finance",
    "BUS361": "Investment Management",
    "BUS362": "Investment Management",
    "BUS3Q1": "Personal Finance—Online",
    "BUS3Q2": "Personal Finance—Online",
    "ENG691": "Topics in Composition: Media Analysis",
    "ENG722": "Topics in Composition: Film Genres",
    "MUS461": "AP Music Theory",
    "MUS462": "AP Music Theory",
    "ART801": "AP Art: Drawing, 2D and 3D Design",
    "ART802": "AP Art: Drawing, 2D and 3D Design",
    "ART871": "AP Photography and Digital Design",
    "ART872": "AP Photography and Digital Design",
    "DNC501": "Concert Dance",
    "DNC502": "Concert Dance",
}

# Regex: a course code is 2-5 uppercase letters, then 2-4 digits, optionally
# a trailing uppercase letter and/or digit (for early-bird / leadership codes).
COURSE_CODE_RE = re.compile(r"\b([A-Z][A-Z/]{1,4}\d{2,4}[A-Z]?\d?)\b")

# Matches a line containing "CODE–Semester N" patterns (one or two codes).
# Allows an optional parenthetical between the code and the dash
# (e.g. "PED031 (early bird)–Semester 1") and matches "Semester"/"Only"
# case-insensitively (some sections use ALL-CAPS like "CHI351-SEMESTER 1").
SEMESTER_LINE_RE = re.compile(
    r"([A-Z][A-Z/]{1,4}\d{2,4}[A-Z]?\d?)"
    r"(?:\s*\([^)]+\))?"
    r"\s*[\u2013\u2014\-–—]\s*(?i:Semester)\s+[12]"
    r"(?:\s+(?i:Only))?"
    r"(?:\s+([A-Z][A-Z/]{1,4}\d{2,4}[A-Z]?\d?)"
    r"(?:\s*\([^)]+\))?"
    r"\s*[\u2013\u2014\-–—]\s*(?i:Semester)\s+[12]"
    r"(?:\s+(?i:Only))?)?"
)

OPEN_TO_RE = re.compile(r"Open\s+to:\s*([\d\-–—]+)", re.IGNORECASE)
CREDIT_RE = re.compile(r"[Cc]redit:\s*(.+?)(?:\s*$|\s{2,})", re.MULTILINE)
PREREQ_RE = re.compile(
    r"[Pp]rerequisite[s]?:\s*(.+?)(?:\s*[Cc]redit:|\n\n|\Z)", re.DOTALL
)

NOISE_LINE_RE = re.compile(
    r"^(GPA WAIVER|DUAL CREDIT|ARTICULATED|EARLY BIRD|HONORS OPTION|"
    r"WWW\.|SCAN QR|COURSE OFFERINGS|Open to|Prerequisite|Credit:|"
    r"One-Semester|Full-Year|Full Year|Semester [12]|"
    r"[A-Z]{2,5}\d{3})",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_grade_levels(text: str) -> list[int]:
    grades = []
    for part in re.split(r"[\-–—,\s]+", text.strip()):
        if part.strip().isdigit():
            g = int(part.strip())
            if 9 <= g <= 12:
                grades.append(g)
    return sorted(set(grades))


def classify_credit_type(credit_text: str, course_name: str = "") -> str:
    t = credit_text.lower().strip()
    nl = course_name.lower().strip()
    if nl.startswith("ap "):
        return "AP"
    if "honors" in t or "honour" in t:
        return "Honors"
    if "accelerated" in t:
        return "Accelerated"
    if "pass" in t and "fail" in t:
        return "Pass/Fail"
    return "CP"


def determine_duration(text_block: str) -> str:
    t = text_block.lower()
    if "full-year" in t or "full year" in t or "full‑year" in t:
        return "full_year"
    return "semester"


def determine_credit_value(duration: str) -> float:
    # Stevenson: 1 semester = 1 credit. Full-year = 2 credits (1 per semester).
    return 2.0 if duration == "full_year" else 1.0


def extract_prerequisite_codes(prereq_text: str) -> list[str]:
    if not prereq_text:
        return []
    codes = COURSE_CODE_RE.findall(prereq_text)
    return [c for c in codes if len(c) >= 4]


def lookup_division_department(code: str) -> tuple[str, str]:
    if code.startswith("D/E"):
        return DIVISION_MAP["D/E"]
    for pfx_len in (4, 3, 2):
        pfx = code[:pfx_len]
        if pfx in DIVISION_MAP:
            return DIVISION_MAP[pfx]
    return ("Unknown", "Unknown")


def clean_name(name: str) -> str:
    # Remove appendix-style noise: dotted lines + page numbers + trailing course codes
    name = re.sub(r"\s*[\.…]{3,}.*$", "", name)
    name = re.sub(r"\s*GPA WAIVER OPTION\s*", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*DUAL CREDIT.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*ARTICULATED CREDIT.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*EARLY BIRD OPTION\s*", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*HONORS OPTION\s*", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*\(CP\)|\s*\(H\)|\s*\(A\)\s*$", "", name)
    # Remove trailing course code references that leak from appendix
    name = re.sub(r"\s+[A-Z]{2,4}\d{3,4}\s+[A-Z]{2,4}\d{3,4}.*$", "", name)
    # Remove trailing single-word noise from column cropping
    name = re.sub(r"\s+Pr\s*$", "", name)
    name = re.sub(r"\s+Cr\s*$", "", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip("–—- \t")


# ---------------------------------------------------------------------------
# Build name lookup from the appendix pages
# ---------------------------------------------------------------------------

def build_appendix_name_map(pdf_path: str) -> dict[str, str]:
    """Parse appendix 'Course List by Name/Number' pages for code->name map."""
    name_map: dict[str, str] = {}

    pdf = pdfplumber.open(pdf_path)
    total_pages = len(pdf.pages)

    appendix_text = ""
    for page_idx in range(total_pages - 15, total_pages - 3):
        page = pdf.pages[page_idx]
        text = page.extract_text()
        if text and ("COURSE LIST" in text.upper() or re.search(r"[A-Z]{3}\d{3}", text)):
            appendix_text += text + "\n"
    pdf.close()

    for line in appendix_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Pattern: CODE1 CODE2 COURSE NAME (TYPE) ......page
        # Type can be: CP, H, A, P/F, or combinations
        m = re.match(
            r"([A-Z][A-Z/]{1,4}\d{2,4}[A-Z]?\d?)\s+"
            r"(?:([A-Z][A-Z/]{1,4}\d{2,4}[A-Z]?\d?)\s+)?"
            r"(?:[—–\-]\s*)?"
            r"(.+?)\s*"
            r"(?:\([A-Z/,\s]+\))?\s*"
            r"[\.…]+\s*\d+\s*$",
            line,
        )
        if m:
            code1, code2, name = m.group(1), m.group(2), m.group(3).strip().rstrip(".")
            # Strip trailing credit type in parens like (CP), (H), (A), (P/F)
            name = re.sub(r"\s*\([A-Z/,\s]+\)\s*$", "", name).strip().rstrip(".")
            if name and len(name) > 2:
                name_map[code1] = name
                if code2:
                    name_map[code2] = name
    return name_map


# ---------------------------------------------------------------------------
# Two-column page extraction
# ---------------------------------------------------------------------------

def is_two_column_course_page(page) -> bool:
    """Detect if a page has course codes in both left and right halves."""
    mid = page.width / 2
    left_text = page.crop((0, 0, mid, page.height)).extract_text() or ""
    right_text = page.crop((mid, 0, page.width, page.height)).extract_text() or ""
    left_codes = SEMESTER_LINE_RE.findall(left_text)
    right_codes = SEMESTER_LINE_RE.findall(right_text)
    return bool(left_codes) and bool(right_codes)


def extract_column_text(page, column: str) -> str:
    """Extract text from the left or right column of a page."""
    mid = page.width / 2
    # Use slight overlap to avoid cutting words at the boundary
    if column == "left":
        crop = page.crop((0, 0, mid + 5, page.height))
    else:
        crop = page.crop((mid - 5, 0, page.width, page.height))
    text = crop.extract_text() or ""

    if column == "left":
        # Right-column characters sometimes leak into left column as single chars.
        # Strip trailing single characters from each line.
        cleaned_lines = []
        for line in text.split("\n"):
            # Remove trailing single character that's likely from the right column
            cleaned = re.sub(r"\s+[A-Za-z]\s*$", "", line)
            cleaned_lines.append(cleaned)
        text = "\n".join(cleaned_lines)

    return text


def extract_page_texts(pdf_path: str, start_page: int, end_page: int) -> list[tuple[int, str]]:
    """
    Extract text from course-content pages, splitting two-column pages
    into separate text blocks.
    Returns list of (page_num, text) where two-column pages produce two entries.
    """
    results = []
    pdf = pdfplumber.open(pdf_path)

    for page_idx in range(start_page, end_page):
        page = pdf.pages[page_idx]
        page_num = page_idx + 1

        if is_two_column_course_page(page):
            left_text = extract_column_text(page, "left")
            right_text = extract_column_text(page, "right")
            if left_text.strip():
                results.append((page_num, left_text))
            if right_text.strip():
                results.append((page_num, right_text))
        else:
            text = page.extract_text()
            if text and text.strip():
                results.append((page_num, text))

    pdf.close()
    return results


# ---------------------------------------------------------------------------
# Course parsing
# ---------------------------------------------------------------------------

def extract_courses_from_pdf(
    pdf_path: str,
    name_map: dict[str, str],
) -> tuple[list[dict], list[str], list[str]]:
    courses: list[dict] = []
    warnings: list[str] = []
    heuristic_fallbacks: list[str] = []
    seen_codes: set[str] = set()

    pdf = pdfplumber.open(pdf_path)
    total_pages = len(pdf.pages)
    pdf.close()

    start_page = 14
    end_page = total_pages - 10

    page_texts = extract_page_texts(pdf_path, start_page, end_page)

    for page_num, text in page_texts:
        page_courses = extract_courses_from_text(
            text, page_num, name_map, warnings, heuristic_fallbacks
        )
        for course in page_courses:
            code = course["code"]
            if code in seen_codes:
                # Duplicate from flowchart/overview page — skip silently
                continue
            seen_codes.add(code)
            courses.append(course)

    # Lake County Tech Campus (VOC) courses use a different layout that the
    # main parser doesn't recognize. Pull them from the dedicated section.
    for course in extract_voc_courses(pdf_path, name_map):
        if course["code"] in seen_codes:
            continue
        seen_codes.add(course["code"])
        courses.append(course)

    return courses, warnings, heuristic_fallbacks


# The Tech Campus list lives in the right column of its page; cropping
# to that column gives us "<Name> VOC###/###" with reliable spacing.
VOC_LINE_RE = re.compile(r"^(.+?)\s+VOC(\d{3})/(\d{3})\s*$", re.MULTILINE)


def extract_voc_courses(pdf_path: str, name_map: dict[str, str]) -> list[dict]:
    """Parse Lake County Tech Campus (VOC) courses from the dedicated section.

    These courses appear in a compact "Name  VOC###/###" layout that the
    standard semester-line parser doesn't see. Per the section preamble
    (page 26 of the 2026-27 catalog), all VOC courses are full-year,
    college-prep, junior/senior, with dual credit through the College of
    Lake County. Descriptions live on techcampus.org and are left blank.
    """
    pdf = pdfplumber.open(pdf_path)
    right_text = ""
    for page in pdf.pages:
        full_text = page.extract_text() or ""
        if "TECHNOLOGY CAMPUS" in full_text.upper() and re.search(r"VOC\d{3}/\d{3}", full_text):
            mid = page.width / 2
            right_text = page.crop((mid - 5, 0, page.width, page.height)).extract_text() or ""
            break
    pdf.close()

    if not right_text:
        return []

    courses: list[dict] = []
    for match in VOC_LINE_RE.finditer(right_text):
        raw_name = match.group(1).strip()
        code1 = f"VOC{match.group(2)}"
        code2 = f"VOC{match.group(3)}"

        # Skip program-area headings if they accidentally match.
        if raw_name.endswith("PROGRAMS"):
            continue

        courses.append(_build(
            code=f"{code1}/{code2}",
            name=raw_name,
            division="Applied Arts",
            department="Lake County Tech Campus",
            description="",
            credit_value=1.0,
            duration="full_year",
            grade_levels=[11, 12],
            credit_type="CP",
            prerequisites=None,
            prerequisite_codes=[],
            corequisites=None,
            is_ap=False,
            is_dual_credit=True,
            notes="Lake County Tech Campus — see techcampus.org for details.",
            semesters_offered=None,
        ))
    return courses


def extract_courses_from_text(
    text: str,
    page_num: int,
    name_map: dict[str, str],
    warnings: list[str],
    heuristic_fallbacks: list[str],
) -> list[dict]:
    """Extract all courses from a single text block (one column of one page)."""
    results = []
    lines = text.split("\n")

    # Find lines containing "CODEn–Semester n" patterns
    code_line_indices = []
    for i, line in enumerate(lines):
        if SEMESTER_LINE_RE.search(line):
            code_line_indices.append(i)

    if not code_line_indices:
        return results

    for idx, cli in enumerate(code_line_indices):
        # Block boundary: from previous code line to this one (for "above" context),
        # and from this code line to the next one (for "below" content).
        above_start = code_line_indices[idx - 1] + 1 if idx > 0 else 0
        above_lines = lines[above_start:cli]

        below_end = code_line_indices[idx + 1] if idx + 1 < len(code_line_indices) else len(lines)
        below_lines = lines[cli + 1:below_end]

        parsed = parse_course_entry(
            lines[cli], above_lines, below_lines, name_map,
            page_num, warnings, heuristic_fallbacks,
        )
        if parsed:
            results.extend(parsed)

    return results


def parse_course_entry(
    code_line: str,
    above_lines: list[str],
    below_lines: list[str],
    name_map: dict[str, str],
    page_num: int,
    warnings: list[str],
    heuristic_fallbacks: list[str],
) -> list[dict]:
    m = SEMESTER_LINE_RE.search(code_line)
    if not m:
        return []
    code1, code2 = m.group(1), m.group(2)

    full_block = code_line + "\n" + "\n".join(below_lines)
    above_text = "\n".join(above_lines)

    # --- Duration ---
    duration = determine_duration(full_block)
    if "full-year" in above_text.lower() or "full year" in above_text.lower():
        duration = "full_year"

    # --- Grade levels ---
    # 1. Search first few lines below the code for "Open to:"
    # 2. If not found, search above lines (Early Bird courses inherit from parent)
    # 3. Default to [9,10,11,12] only as last resort
    grade_levels = []
    nearby_below = code_line + "\n" + "\n".join(below_lines[:6])
    open_match = OPEN_TO_RE.search(nearby_below)
    if open_match:
        grade_levels = parse_grade_levels(open_match.group(1))
    if not grade_levels:
        # Search above lines in reverse (closest "Open to:" first)
        for above_line in reversed(above_lines[-8:]):
            above_match = OPEN_TO_RE.search(above_line)
            if above_match:
                grade_levels = parse_grade_levels(above_match.group(1))
                break
    if not grade_levels:
        grade_levels = [9, 10, 11, 12]

    # Apply manual grade overrides for known parsing errors
    if code1 in MANUAL_GRADE_OVERRIDES:
        grade_levels = MANUAL_GRADE_OVERRIDES[code1]

    # --- Credit type ---
    credit_text_raw = ""
    credit_match = CREDIT_RE.search(full_block)
    if credit_match:
        credit_text_raw = re.split(r"\s{2,}|\n", credit_match.group(1).strip())[0].strip()

    # --- Course name ---
    course_name = MANUAL_NAME_OVERRIDES.get(code1, "")
    if not course_name and code2:
        course_name = MANUAL_NAME_OVERRIDES.get(code2, "")
    if not course_name:
        course_name = find_course_name(code1, code2, above_lines, name_map)
    if not course_name:
        heuristic_fallbacks.append(code1)
        warnings.append(f"Page {page_num}: Could not determine name for {code1}")
        course_name = name_map.get(code1, f"Course {code1}")
    course_name = clean_name(course_name)

    # --- Credit type (needs name) ---
    credit_type = classify_credit_type(credit_text_raw, course_name)

    # --- AP? ---
    is_ap = credit_type == "AP" or course_name.upper().startswith("AP ")
    if is_ap:
        credit_type = "AP"

    # For courses with "honors" credit and AP in name, fix the type
    if "AP " in course_name and credit_type == "Honors":
        # Courses like "AP Biology" have honors-weighted credit but are AP courses
        credit_type = "AP"
        is_ap = True

    # --- Dual credit? ---
    full_context = above_text + "\n" + full_block
    is_dual_credit = bool(
        re.search(r"dual\s+credit", full_context, re.IGNORECASE)
        or re.search(r"articulated\s+credit", full_context, re.IGNORECASE)
    )

    # --- Credit value ---
    credit_value = determine_credit_value(duration)

    # --- Prerequisites ---
    prereq_text = ""
    prereq_match = PREREQ_RE.search(full_block)
    if prereq_match:
        prereq_text = prereq_match.group(1).strip()
        prereq_text = re.sub(r"\s+", " ", prereq_text).strip()
        prereq_text = re.sub(r"\s*[Cc]redit:.*$", "", prereq_text).strip()
    has_prereq = bool(prereq_text) and prereq_text.lower() not in (
        "none", "none.", "n/a", "none credit",
    )
    prereq_codes = extract_prerequisite_codes(prereq_text) if has_prereq else []

    # --- Co-requisites ---
    coreq_text = ""
    coreq_match = re.search(r"[Cc]o-?requisite[s]?:\s*(.+?)(?:\n|$)", full_block)
    if coreq_match:
        coreq_text = coreq_match.group(1).strip()

    # --- Description ---
    description = extract_description(below_lines)

    # --- Notes ---
    notes_parts = []
    if re.search(r"GPA WAIVER OPTION", full_context, re.IGNORECASE):
        notes_parts.append("GPA waiver option available")
    if is_dual_credit:
        dc_match = re.search(
            r"DUAL CREDIT AVAILABLE.*?(?:WITH|THROUGH)\s+(.+?)(?:\n|$)",
            full_context, re.IGNORECASE,
        )
        if dc_match:
            notes_parts.append(f"Dual credit available with {dc_match.group(1).strip()}")
        else:
            art_match = re.search(
                r"ARTICULATED CREDIT.*?(?:WITH|THROUGH)\s+(.+?)(?:\n|$)",
                full_context, re.IGNORECASE,
            )
            if art_match:
                notes_parts.append(f"Articulated credit with {art_match.group(1).strip()}")
            else:
                notes_parts.append("Dual credit available")
    if re.search(r"EARLY BIRD OPTION", full_context, re.IGNORECASE):
        notes_parts.append("Early bird option available")
    if re.search(r"may be repeated|can be taken.*more than one semester",
                 full_block, re.IGNORECASE):
        notes_parts.append("May be repeated for credit")
    notes = "; ".join(notes_parts) if notes_parts else None

    # --- Division / Department ---
    division, department = lookup_division_department(code1)

    # --- Semester offered (for single-semester courses) ---
    # Parse from code line: "BUS411–Semester 1 BUS412–Semester 2"
    # or "BUS252–Semester 2 Only"
    sem1_offered = False
    sem2_offered = False
    sem_matches = re.findall(
        r"([A-Z][A-Z/]{1,4}\d{2,4}[A-Z]?\d?)"
        r"(?:\s*\([^)]+\))?"
        r"\s*[\u2013\u2014\-–—]\s*(?i:Semester)\s+([12])(\s+(?i:Only))?",
        code_line,
    )
    sem_by_code: dict[str, int] = {}
    for sm_code, sm_num, _ in sem_matches:
        sem_by_code[sm_code] = int(sm_num)
        if sm_num == "1":
            sem1_offered = True
        else:
            sem2_offered = True

    # --- Build course objects ---
    results = []
    if duration == "full_year" and code2:
        results.append(_build(
            f"{code1}/{code2}", course_name, division, department, description,
            credit_value, duration, grade_levels, credit_type, prereq_text if has_prereq else None,
            prereq_codes, coreq_text or None, is_ap, is_dual_credit, notes,
            semesters_offered=None,  # full-year: spans both semesters
        ))
    elif code2:
        for code in (code1, code2):
            sem_num = sem_by_code.get(code)
            results.append(_build(
                code, course_name, division, department, description,
                credit_value, duration, grade_levels, credit_type,
                prereq_text if has_prereq else None, prereq_codes,
                coreq_text or None, is_ap, is_dual_credit, notes,
                semesters_offered=[sem_num] if sem_num else ([1, 2] if sem1_offered and sem2_offered else None),
            ))
    else:
        # Single code — check if THIS code specifies "Only"
        sem_num = sem_by_code.get(code1)
        only = any(s_only for s_code, _, s_only in sem_matches if s_only and s_code == code1)
        results.append(_build(
            code1, course_name, division, department, description,
            credit_value, duration, grade_levels, credit_type,
            prereq_text if has_prereq else None, prereq_codes,
            coreq_text or None, is_ap, is_dual_credit, notes,
            semesters_offered=[sem_num] if sem_num else ([1, 2] if duration == "semester" else None),
        ))
    return results


def find_course_name(
    code1: str, code2: str | None,
    above_lines: list[str],
    name_map: dict[str, str],
) -> str:
    """Find course name, preferring the appendix name map (authoritative) over above-lines."""
    # Primary source: appendix name map (clean, reliable two-column table)
    if code1 in name_map:
        return name_map[code1]
    if code2 and code2 in name_map:
        return name_map[code2]

    # Fallback: scan lines above the code line in the body text
    candidates = []
    for line in reversed(above_lines):
        stripped = line.strip()
        if not stripped or len(stripped) < 3:
            continue
        if NOISE_LINE_RE.match(stripped):
            continue
        if re.match(r"^\d+\s+[A-Z]", stripped) or re.match(r"^[A-Z\s]+\d+$", stripped):
            continue
        if SEMESTER_LINE_RE.search(stripped):
            continue
        if re.match(r"^(One-Semester|Full-Year|Full Year)\s+(Course)", stripped, re.IGNORECASE):
            continue
        # Skip very long all-caps lines (department intro paragraphs)
        if len(stripped) > 100 and stripped == stripped.upper():
            continue
        # Skip lines that look like description fragments (start with lowercase)
        if stripped[0].islower():
            continue
        candidates.append(stripped)
        if len(candidates) >= 3:
            break

    if candidates:
        for cand in candidates:
            cleaned = clean_name(cand)
            if cleaned and len(cleaned) > 2:
                return cleaned

    return ""


def extract_description(below_lines: list[str]) -> str:
    desc_lines = []
    past_metadata = False
    meta_kw = ("open to:", "prerequisite", "credit:", "note:", "early bird")

    for line in below_lines:
        stripped = line.strip()
        lower = stripped.lower()
        if not stripped:
            continue
        if any(lower.startswith(p) for p in meta_kw):
            past_metadata = True
            continue
        if not past_metadata:
            continue
        if re.match(r"^\d+\s+[A-Z]", stripped) or re.match(r"^[A-Z\s\-–—]+\d+$", stripped):
            continue
        if "COURSE OFFERINGS" in stripped.upper():
            break
        if SEMESTER_LINE_RE.search(stripped):
            break
        desc_lines.append(stripped)

    desc = re.sub(r"\s{2,}", " ", " ".join(desc_lines)).strip()
    # Remove leading single-character noise from column cropping artifacts
    desc = re.sub(r"^([A-Za-z] ){1,3}", "", desc).strip()
    return desc


def _build(
    code, name, division, department, description,
    credit_value, duration, grade_levels, credit_type,
    prerequisites, prerequisite_codes, corequisites,
    is_ap, is_dual_credit, notes,
    semesters_offered=None,
) -> dict:
    # Detect GPA waiver from description or notes
    combined_text = ((description or "") + " " + (notes or "")).upper()
    gpa_waiver = "GPA WAIVER" in combined_text

    return {
        "code": code,
        "name": name,
        "division": division,
        "department": department,
        "description": description,
        "credit_value": credit_value,
        "duration": duration,
        "grade_levels": grade_levels,
        "credit_type": credit_type,
        "prerequisites": prerequisites,
        "prerequisite_codes": prerequisite_codes,
        "corequisites": corequisites,
        "is_ap": is_ap,
        "is_dual_credit": is_dual_credit,
        "gpa_waiver": gpa_waiver,
        "semesters_offered": semesters_offered,
        "notes": notes,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = ["code", "name", "division", "credit_value", "duration", "grade_levels"]
VALID_CREDIT_TYPES = {"CP", "Accelerated", "Honors", "AP", "Pass/Fail"}


def validate_courses(courses: list[dict]) -> tuple[bool, list[str]]:
    errors = []
    for c in courses:
        missing = [f for f in REQUIRED_FIELDS if not c.get(f)]
        if missing:
            errors.append(f"Course {c.get('code', '???')}: missing required fields: {missing}")

    code_counts: dict[str, int] = defaultdict(int)
    for c in courses:
        code_counts[c["code"]] += 1
    for code, count in code_counts.items():
        if count > 1:
            errors.append(f"Duplicate course code: {code} appears {count} times")

    for c in courses:
        cv = c.get("credit_value", 0)
        if not (0.25 <= cv <= 2.0):
            errors.append(f"Course {c['code']}: credit_value {cv} outside range 0.25-2.0")

    for c in courses:
        gl = c.get("grade_levels", [])
        invalid = [g for g in gl if g not in (9, 10, 11, 12)]
        if invalid:
            errors.append(f"Course {c['code']}: invalid grade levels: {invalid}")
        if not gl:
            errors.append(f"Course {c['code']}: empty grade_levels")

    for c in courses:
        ct = c.get("credit_type", "")
        if ct not in VALID_CREDIT_TYPES:
            errors.append(f"Course {c['code']}: invalid credit_type '{ct}'")

    return len(errors) == 0, errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Extract courses from Stevenson High School course catalog PDF"
    )
    parser.add_argument("pdf_path", help="Path to the course catalog PDF")
    parser.add_argument("--year", type=int, default=None,
                        help="Catalog year (default: inferred from filename)")
    parser.add_argument("--out-dir", default=None,
                        help="Output directory (default: ./data/)")
    args = parser.parse_args()

    pdf_path = args.pdf_path
    if not os.path.isfile(pdf_path):
        print(f"ERROR: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    year = args.year
    if year is None:
        ym = re.search(r"20(\d{2})", os.path.basename(pdf_path))
        year = int("20" + ym.group(1)) if ym else datetime.now().year

    out_dir = args.out_dir or os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Extracting courses from: {pdf_path}")
    print(f"Catalog year: {year}")
    print(f"Output directory: {out_dir}")
    print()

    # Phase 0: appendix name lookup
    print("Phase 0: Building course name lookup from appendix...")
    name_map = build_appendix_name_map(pdf_path)
    print(f"  Found {len(name_map)} course names in appendix")
    print()

    # Phase 1: main extraction (two-column aware)
    courses, warnings, heuristic_fallbacks = extract_courses_from_pdf(pdf_path, name_map)
    print(f"Phase 1 (main extraction): {len(courses)} courses found")
    print()

    # Phase 2: post-process name cleanup
    cleanup_count = 0
    for c in courses:
        original = c["name"]
        name = c["name"]

        # Strip credit type suffixes like "(CP, A)", "(H)", "(P/F)"
        name = re.sub(r"\s*\([A-Z,/\s]+\)\s*$", "", name).strip()

        # Fix junk appended from adjacent columns (detect course codes mid-name)
        junk_match = re.search(r"\s+[A-Z]{2,4}\d{2,3}[A-Z]?\d?\s+[A-Z]{2,4}\d{2,3}", name)
        if junk_match:
            name = name[:junk_match.start()].strip()

        # Title-case names that are all lowercase
        if name and name[0].islower():
            name = name.title()

        if name != original:
            c["name"] = name
            cleanup_count += 1

    if cleanup_count:
        print(f"Phase 2 (name cleanup): fixed {cleanup_count} course names")
        print()

    # Phase 3: resolve prerequisite names to course codes
    # Build name-to-code lookup (lowercase name -> list of codes)
    name_to_codes: dict[str, list[str]] = {}
    for c in courses:
        key = c["name"].strip().lower()
        if key not in name_to_codes:
            name_to_codes[key] = []
        name_to_codes[key].append(c["code"])

    all_codes = {c["code"] for c in courses}
    resolved_count = 0

    for c in courses:
        prereq_text = c.get("prerequisites", "")
        if not prereq_text:
            continue

        existing_codes = set(c.get("prerequisite_codes", []))
        new_codes: list[str] = list(existing_codes)

        # 1. Extract explicit codes from parentheses: "AP Calculus AB (MTH471/472)"
        paren_codes = re.findall(r"\(([A-Z]{2,4}\d{2,4}(?:/\d{2,4})?(?:/[A-Z]{2,4}\d{2,4})?)\)", prereq_text)
        for pc in paren_codes:
            # Handle shorthand like "MTH471/472" -> "MTH471/MTH472"
            if re.match(r"[A-Z]{2,4}\d{2,4}/\d{2,4}$", pc):
                prefix = re.match(r"([A-Z]{2,4})", pc).group(1)
                parts = pc.split("/")
                expanded = f"{parts[0]}/{prefix}{parts[1]}"
                if expanded in all_codes:
                    new_codes.append(expanded)
                elif parts[0] in all_codes:
                    new_codes.append(parts[0])
            elif pc in all_codes:
                new_codes.append(pc)

        # 2. Match prerequisite names to course names
        # Clean up the prereq text: split on "or", "and", commas
        prereq_fragments = re.split(r"\s+(?:or|and|,)\s+", prereq_text.lower())
        for frag in prereq_fragments:
            frag = frag.strip().rstrip(".")
            # Remove qualifiers like "passing the placement exam for"
            frag = re.sub(r"^(?:passing the placement (?:exam|test) for|completion of|teacher approval.*|approval.*|placement.*)\s*", "", frag).strip()
            if not frag or len(frag) < 4:
                continue

            # Try exact match
            if frag in name_to_codes:
                for code in name_to_codes[frag]:
                    new_codes.append(code)
                continue

            # Try matching with common suffixes stripped
            for stored_name, codes in name_to_codes.items():
                if frag in stored_name or stored_name in frag:
                    for code in codes:
                        new_codes.append(code)
                    break

        # Dedupe and remove self-references + semester-pair siblings (same name)
        own_codes = {c["code"]}
        # Also add individual parts if composite code
        if "/" in c["code"]:
            own_codes.update(c["code"].split("/"))
        # Exclude semester pairs: other courses with the exact same name
        for sibling in name_to_codes.get(c["name"].strip().lower(), []):
            own_codes.add(sibling)

        resolved = []
        seen = set()
        for code in new_codes:
            if code not in seen and code not in own_codes and code in all_codes:
                resolved.append(code)
                seen.add(code)

        if len(resolved) > len(existing_codes):
            resolved_count += 1

        c["prerequisite_codes"] = resolved

        # Build structured prerequisite_groups with AND/OR semantics
        # requirement_group semantics: same group = OR (any one satisfies), different groups = AND (all must be satisfied)
        prereq_text_raw = c.get("prerequisites", "") or ""
        groups: list[list[str]] = []

        # Pattern 1: "One course required from: and One course required from: ..."
        # Two-column PDF interleaves bullet items: odd positions = group 1, even = group 2
        if "required from:" in prereq_text_raw.lower() and prereq_text_raw.lower().count("required from:") >= 2:
            items = re.split(r"[■•]", prereq_text_raw)
            items = [it.strip().rstrip(".").strip() for it in items if it.strip() and len(it.strip()) > 2]
            items = [it for it in items if not re.match(r"^(one course|and|or)\b", it, re.IGNORECASE)
                     and "required from" not in it.lower()]

            group1_codes: list[str] = []
            group2_codes: list[str] = []
            for idx, item in enumerate(items):
                item_lower = item.lower()
                matched_codes: list[str] = []
                for name_key, codes_list in name_to_codes.items():
                    if item_lower == name_key or item_lower in name_key or name_key in item_lower:
                        for code in codes_list:
                            if code in all_codes and code not in own_codes:
                                matched_codes.append(code)
                        break
                if matched_codes:
                    if idx % 2 == 0:
                        group1_codes.extend(matched_codes)
                    else:
                        group2_codes.extend(matched_codes)

            if group1_codes:
                groups.append(list(dict.fromkeys(group1_codes)))
            if group2_codes:
                groups.append(list(dict.fromkeys(group2_codes)))

        # For patterns 2-4, check if all resolved codes are semester variants
        # (same course name). If so, they're always a single OR group.
        else:
            code_to_name = {cc["code"]: cc["name"] for cc in courses}
            resolved_names = {code_to_name.get(rc, "") for rc in resolved}
            all_same_course = len(resolved_names) <= 1

            if all_same_course or " or " in prereq_text_raw.lower():
                # Single OR group: semester variants of the same course, or explicit "or"
                if resolved:
                    groups.append(resolved)

            elif " and " in prereq_text_raw.lower():
                # "X and Y" where X and Y are genuinely different courses → AND groups
                # Group resolved codes by course name — same name = one OR group
                name_groups: dict[str, list[str]] = {}
                for rc in resolved:
                    rname = code_to_name.get(rc, rc)
                    if rname not in name_groups:
                        name_groups[rname] = []
                    name_groups[rname].append(rc)
                for ng_codes in name_groups.values():
                    groups.append(ng_codes)

            else:
                # Default: everything in one OR group
                if resolved:
                    groups.append(resolved)

        c["prerequisite_groups"] = [
            {"group": i + 1, "type": "or", "codes": g}
            for i, g in enumerate(groups)
            if g
        ]

    total_links = sum(len(c.get("prerequisite_codes", [])) for c in courses)
    print(f"Phase 3 (prerequisite resolution): {resolved_count} courses gained new prerequisite links")
    print(f"  Total prerequisite links: {total_links}")
    print()

    # Validation
    is_valid, validation_errors = validate_courses(courses)
    if validation_errors:
        print(f"Validation issues ({len(validation_errors)}):")
        for err in validation_errors[:20]:
            print(f"  - {err}")
        if len(validation_errors) > 20:
            print(f"  ... and {len(validation_errors) - 20} more")
    else:
        print("Validation: PASSED (all checks)")
    print()

    # Stats
    divisions: dict[str, int] = defaultdict(int)
    departments: dict[str, int] = defaultdict(int)
    credit_types: dict[str, int] = defaultdict(int)
    ap_count = sum(1 for c in courses if c["is_ap"])
    dual_credit_count = sum(1 for c in courses if c["is_dual_credit"])
    for c in courses:
        divisions[c["division"]] += 1
        departments[c["department"]] += 1
        credit_types[c["credit_type"]] += 1

    # Write courses.json
    courses_path = os.path.join(out_dir, f"{year}-courses.json")
    output = {
        "catalog_year": year,
        "school": "Adlai E. Stevenson High School",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "total_courses": len(courses),
        "courses": sorted(courses, key=lambda c: c["code"]),
    }
    with open(courses_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Wrote {courses_path}")

    # Write extraction report
    report_path = os.path.join(out_dir, f"{year}-extraction-report.json")
    all_codes = set()
    for c in courses:
        all_codes.add(c["code"])
        if "/" in c["code"]:
            all_codes.update(c["code"].split("/"))
    unresolved = []
    for c in courses:
        for pc in c.get("prerequisite_codes", []):
            if pc not in all_codes:
                unresolved.append({"course": c["code"], "unresolved_prereq": pc})

    report = {
        "catalog_year": year,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "pdf_path": os.path.abspath(pdf_path),
        "total_courses": len(courses),
        "validation_passed": is_valid,
        "validation_errors": validation_errors,
        "warnings": warnings,
        "unresolved_prerequisite_references": unresolved,
        "stats": {
            "by_division": dict(sorted(divisions.items())),
            "by_department": dict(sorted(departments.items())),
            "by_credit_type": dict(sorted(credit_types.items())),
            "ap_courses": ap_count,
            "dual_credit_courses": dual_credit_count,
        },
        "heuristic_fallback_courses": heuristic_fallbacks,
    }
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Wrote {report_path}")

    # Summary
    print()
    print("=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"  Total courses:       {len(courses)}")
    print(f"  AP courses:          {ap_count}")
    print(f"  Dual credit courses: {dual_credit_count}")
    print(f"  Warnings:            {len(warnings)}")
    print(f"  Validation errors:   {len(validation_errors)}")
    print(f"  Heuristic fallbacks: {len(heuristic_fallbacks)}")
    print()
    print("  Courses by division:")
    for div, count in sorted(divisions.items()):
        print(f"    {div}: {count}")
    print()
    print("  Courses by credit type:")
    for ct, count in sorted(credit_types.items()):
        print(f"    {ct}: {count}")
    print()

    if not is_valid:
        print("WARNING: Validation failed. Review errors before loading into database.")
        sys.exit(2)
    print("Extraction complete. Review the JSON output before running loader.py.")


if __name__ == "__main__":
    main()
