#!/usr/bin/env python3
"""
Stevenson High School Summer School PDF Extractor

Reads the summer school course catalog PDF and produces:
  - data/YYYY-summer-courses.json  (structured course data)

Usage:
    python extract_summer.py <path-to-pdf> [--year YYYY] [--out-dir DIR]

The summer school PDF uses a simpler layout than the main coursebook:
  - Course content is on pages 8-19 (single column, not two-column)
  - Each course has: title, code pattern (e.g., "BUS71S"), dates, times,
    open-to grades, credit info, cost, prerequisites, and description
  - Semester codes end in "S" (e.g., "MTH15S" for summer Algebra 1)
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

import pdfplumber

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DIVISION_MAP = {
    "BUS": ("Applied Arts", "Business Education"),
    "D/E": ("Applied Arts", "Driver Education"),
    "ENG": ("Communication Arts", "English"),
    "CSC": ("Computer Science, Engineering and Technology", "Computer Science"),
    "TEC": ("Computer Science, Engineering and Technology", "Engineering and Technology"),
    "ART": ("Fine Arts", "Visual Arts"),
    "THR": ("Fine Arts", "Theatre"),
    "MTH": ("Mathematics", "Mathematics"),
    "ELD": ("Multilingual Learning", "ELD"),
    "ELL": ("Multilingual Learning", "ELD"),
    "PED": ("Physical Welfare", "Physical Education"),
    "SCI": ("Science", "Science"),
    "SOC": ("Social Studies", "Social Studies"),
    "IEN": ("Special Education", "Special Education"),
    "IJOB": ("Special Education", "Special Education"),
    "TCH": ("Student Services", "Student Services"),
    "CAR": ("Student Learning Programs", "Career Exploration"),
    "ACT": ("Student Learning Programs", "ACT Prep"),
}

# Manual name overrides — the two-column PDF layout causes name extraction
# errors. Since there are only ~35 summer courses, manual names are reliable.
MANUAL_NAMES: dict[str, str] = {
    "D/E21S": "Driver Education",
    "D/E22S": "Driver Education",
    "BUS71S": "Introduction to Business",
    "BUS72S": "Introduction to Business",
    "BUS12S": "Business Applications and Technology 1",
    "CAR53S": "Careers in Business",
    "CAR35S": "Careers in Law",
    "CAR31S": "Careers in Healthcare and Medicine",
    "CAR33S": "Careers in Healthcare and Medicine",
    "CAR62S": "Careers in STEM",
    "ENG25S": "English Failure Credit Recovery",
    "ENG51S": "College Essay Workshop",
    "ENG53S": "College Essay Workshop",
    "ENG55S": "College Essay Workshop",
    "ENG54S": "College Essay Workshop",
    "ENG56S": "College Essay Workshop",
    "ENG71S": "Reading for College",
    "ENG57S": "Creative Writing",
    "CSC61S": "Computer Programming 1",
    "CSC82S": "Computer Programming 2",
    "ART11S": "Art and Design",
    "ART12S": "Art and Design",
    "ART31S": "Photography 1",
    "ART32S": "Photography 1",
    "ART51S": "Digital Art and Design 1",
    "ART52S": "Digital Art and Design 1",
    "THR11S": "Theatre Arts",
    "MTH15S": "Algebra 1",
    "MTH16S": "Algebra 1",
    "MTH25S": "Geometry",
    "MTH26S": "Geometry",
    "MTH51S": "Algebra 2",
    "MTH52S": "Algebra 2",
    "MTH37S": "Algebra 2 AB/BC",
    "MTH38S": "Algebra 2 AB/BC",
    "ELD11S": "ELD Skills in Focus: Oracy and Literacy",
    "ELD21S": "ELD English Enrichment",
    "ELD32S": "ELD Study Skills",
    "PED21S": "Health Education",
    "PED22S": "Health Education",
    "SCI21S": "Astronomy",
    "SCI31S": "Introduction to Biotechnology",
    "SCI33S": "Introduction to Biotechnology",
    "SOC13S": "World History and Geography",
    "SOC14S": "World History and Geography",
    "SOC41S": "U.S. History",
    "SOC42S": "U.S. History",
    "SOC33S": "U.S. Government",
    "SOC34S": "U.S. Government",
    "SOC43S": "Economics",
    "SOC44S": "Economics",
    "IEN51S": "Reading and Writing for Stevenson",
    "IEN52S": "Reading and Writing for Stevenson",
    "IJOB2S": "Preparing for Life",
    "TCH91S": "Keys to Success",
    "TCH92S": "Keys to Success",
    "ACTPREPS": "ACT Preparatory Course",
    "ACTPREPS2": "ACT Preparatory Course",
}

# Regex to match summer course codes (end with S, optionally followed by digits)
# Examples: BUS71S, D/E21S, MTH15S, CAR53S, ENG51S, ACTPREPS
SUMMER_CODE_RE = re.compile(
    r"([A-Z/]{2,5}\d{0,4}S\d?)\s*:"
)

# Alternate pattern for codes like "ACTPREPS:" or "ACTPREPS2:"
ALT_CODE_RE = re.compile(
    r"([A-Z]{3,}S\d?)\s*:"
)

# Open-to pattern: "Open to: 9-10-11-12" or "OPEN TO: 10-11-12"
OPEN_TO_RE = re.compile(
    r"(?:open\s+to|OPEN\s+TO)\s*:\s*([\d\-]+)",
    re.IGNORECASE
)

# Credit pattern
CREDIT_RE = re.compile(
    r"([\d.]+)\s+(?:semester\s+)?credit",
    re.IGNORECASE
)

# GPA waiver
GPA_WAIVER_RE = re.compile(r"gpa\s+waiver", re.IGNORECASE)

# Pass/fail
PASS_FAIL_RE = re.compile(r"pass/fail", re.IGNORECASE)

# Prerequisite
PREREQ_RE = re.compile(r"prerequisite\s*:\s*(.+?)(?:\n|$)", re.IGNORECASE)

# Cost
COST_RE = re.compile(r"cost\s*:\s*\$?([\d,]+)", re.IGNORECASE)

# Course pages in the summer PDF (0-indexed)
COURSE_PAGE_START = 7  # Page 8
COURSE_PAGE_END = 19   # Through page 19


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def extract_division(code: str) -> tuple[str, str]:
    """Map a course code prefix to (division, department)."""
    # Try exact prefix matches, longest first
    for prefix_len in (4, 3, 2):
        prefix = code[:prefix_len].rstrip("0123456789")
        if prefix in DIVISION_MAP:
            return DIVISION_MAP[prefix]
    return ("Other", "Other")


def parse_grade_levels(text: str) -> list[int]:
    """Parse grade levels from 'Open to: 9-10-11-12' text."""
    match = OPEN_TO_RE.search(text)
    if not match:
        return [9, 10, 11, 12]  # Default: all grades
    raw = match.group(1)
    grades = []
    for part in raw.split("-"):
        part = part.strip()
        if part.isdigit():
            g = int(part)
            if 9 <= g <= 12:
                grades.append(g)
    return grades or [9, 10, 11, 12]


def parse_credit_value(text: str) -> float:
    """Parse credit value from course text."""
    match = CREDIT_RE.search(text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return 1.0  # Default: 1 semester credit


def determine_semesters_offered(text: str, codes: list[str]) -> list[int]:
    """
    Determine which summer semesters the course is offered in.
    -2 = Summer Session 1 (June), -1 = Summer Session 2 (July)
    """
    text_lower = text.lower()

    # Check for "either semester" — both sessions
    if "either semester" in text_lower or "offered either" in text_lower:
        return [-2, -1]

    # Check for explicit first/second semester mentions
    has_first = "first semester" in text_lower or "june 2" in text_lower
    has_second = "second semester" in text_lower or "june 29" in text_lower or "july" in text_lower

    # Check code suffixes: odd number = S1, even number = S2
    for code in codes:
        # Strip the trailing S and check the digit before it
        base = code.rstrip("S").rstrip("0123456789")
        num_part = code[len(base):].rstrip("S")
        if num_part:
            last_digit = int(num_part[-1])
            if last_digit % 2 == 1:  # Odd = S1 (e.g., BUS71S)
                has_first = True
            else:  # Even = S2 (e.g., BUS72S)
                has_second = True

    if has_first and has_second:
        return [-2, -1]
    elif has_first:
        return [-2]
    elif has_second:
        return [-1]
    return [-2, -1]  # Default: both


def extract_courses_from_page(text: str) -> list[dict]:
    """Extract course entries from a single page's text."""
    courses = []

    # Find all course code occurrences to split the text into blocks
    code_positions = []
    for match in SUMMER_CODE_RE.finditer(text):
        code_positions.append((match.start(), match.group(1)))

    # Also try alternate pattern
    for match in ALT_CODE_RE.finditer(text):
        code = match.group(1)
        pos = match.start()
        # Avoid duplicates
        if not any(abs(pos - p) < 5 for p, _ in code_positions):
            code_positions.append((pos, code))

    code_positions.sort(key=lambda x: x[0])

    if not code_positions:
        return courses

    # Group codes that are close together (same course, multiple semester codes)
    course_blocks = []
    current_codes = [code_positions[0][1]]
    current_start = code_positions[0][0]

    for i in range(1, len(code_positions)):
        pos, code = code_positions[i]
        prev_pos = code_positions[i-1][0]

        # If codes are within 100 chars, they're likely the same course (e.g., BUS71S/BUS72S)
        if pos - prev_pos < 100:
            current_codes.append(code)
        else:
            # New course block — save previous
            # Find the end of this block (start of next block or end of text)
            end = pos
            course_blocks.append((current_start, end, current_codes))
            current_codes = [code]
            current_start = pos

    # Don't forget the last block
    course_blocks.append((current_start, len(text), current_codes))

    for start, end, codes in course_blocks:
        block_text = text[max(0, start - 200):end]  # Include some context before codes

        # Determine credit type
        is_pass_fail = bool(PASS_FAIL_RE.search(block_text))
        has_gpa_waiver = bool(GPA_WAIVER_RE.search(block_text))
        credit_type = "Pass/Fail" if is_pass_fail else "CP"

        # Parse fields
        grade_levels = parse_grade_levels(block_text)
        credit_value = parse_credit_value(block_text)
        semesters = determine_semesters_offered(block_text, codes)

        # Extract prerequisite
        prereq_match = PREREQ_RE.search(block_text)
        prereq_text = prereq_match.group(1).strip() if prereq_match else None
        if prereq_text and prereq_text.lower() == "none":
            prereq_text = None

        # Extract cost
        cost_match = COST_RE.search(block_text)
        cost = cost_match.group(1) if cost_match else None

        # Use the first code as primary
        primary_code = codes[0]

        # Use manual name override if available, else extract from text
        name = MANUAL_NAMES.get(primary_code) or extract_course_name(text, start, codes)

        courses.append({
            "codes": codes,
            "primary_code": primary_code,
            "name": name,
            "grade_levels": grade_levels,
            "credit_value": credit_value,
            "credit_type": credit_type,
            "gpa_waiver": has_gpa_waiver,
            "semesters_offered": semesters,
            "prerequisite_text": prereq_text,
            "cost": cost,
            "description": block_text.strip()[:500],
            "is_summer": True,
        })

    return courses


def extract_course_name(full_text: str, code_pos: int, codes: list[str]) -> str:
    """Try to extract the course name from text near the code position."""
    # Look backwards from the code position for a title-like line
    # Summer PDF titles are typically ALL CAPS or Title Case on their own line
    preceding = full_text[max(0, code_pos - 300):code_pos]
    lines = preceding.strip().split("\n")

    # Walk backwards through lines looking for a title
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        # Skip lines that look like metadata
        if any(kw in line.lower() for kw in [
            "open to", "credit", "cost:", "prerequisite", "offered",
            "semester", "a.m.", "p.m.", "june", "july", "gpa waiver"
        ]):
            continue
        # Skip lines that are just codes
        if all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/: " for c in line) and len(line) < 15:
            continue
        # This might be the title
        if len(line) > 3:
            return line.upper()

    # Fallback: use the code itself
    return codes[0]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Extract summer school courses from PDF")
    parser.add_argument("pdf_path", help="Path to summer school PDF")
    parser.add_argument("--year", type=int, default=2026, help="Catalog year (default: 2026)")
    parser.add_argument("--out-dir", default=None, help="Output directory (default: data/)")
    args = parser.parse_args()

    out_dir = args.out_dir or os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Extracting summer courses from: {args.pdf_path}")

    pdf = pdfplumber.open(args.pdf_path)
    print(f"PDF has {len(pdf.pages)} pages")

    all_courses = []

    for page_idx in range(COURSE_PAGE_START, min(COURSE_PAGE_END, len(pdf.pages))):
        text = pdf.pages[page_idx].extract_text() or ""
        page_courses = extract_courses_from_page(text)
        if page_courses:
            print(f"  Page {page_idx + 1}: {len(page_courses)} course(s)")
            all_courses.extend(page_courses)

    pdf.close()

    # Filter out false positives (non-course codes)
    FALSE_CODES = {"FOCUS", "TPREPS", "NOTES"}
    all_courses = [c for c in all_courses if c["primary_code"] not in FALSE_CODES]

    # Deduplicate by primary code
    seen = set()
    unique_courses = []
    for course in all_courses:
        key = course["primary_code"]
        if key not in seen:
            seen.add(key)
            # Resolve division/department
            div, dept = extract_division(key)
            course["division"] = div
            course["department"] = dept
            course["duration"] = "semester"  # All summer courses are semester-length
            unique_courses.append(course)

    # Build output structure matching main extractor format
    output = {
        "metadata": {
            "source": os.path.basename(args.pdf_path),
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "year": args.year,
            "type": "summer",
            "total_courses": len(unique_courses),
        },
        "courses": [
            {
                "code": c["primary_code"],
                "all_codes": c["codes"],
                "name": c["name"],
                "division": c["division"],
                "department": c["department"],
                "description": c["description"],
                "credit_value": c["credit_value"],
                "duration": c["duration"],
                "credit_type": c["credit_type"],
                "grade_levels": c["grade_levels"],
                "semesters_offered": c["semesters_offered"],
                "gpa_waiver": c["gpa_waiver"],
                "is_summer": True,
                "prerequisite_text": c["prerequisite_text"],
                "prerequisite_groups": [],  # Summer courses don't have complex prereq chains
                "cost": c["cost"],
            }
            for c in unique_courses
        ],
    }

    out_path = os.path.join(out_dir, f"{args.year}-summer-courses.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Extracted {len(unique_courses)} summer courses → {out_path}")

    # Print summary by division
    by_div = {}
    for c in unique_courses:
        div = c["division"]
        by_div.setdefault(div, []).append(c)

    print("\nBy division:")
    for div in sorted(by_div):
        courses = by_div[div]
        print(f"  {div}: {len(courses)} courses")
        for c in courses:
            print(f"    {c['primary_code']:10s} {c['name'][:50]}")


if __name__ == "__main__":
    main()
