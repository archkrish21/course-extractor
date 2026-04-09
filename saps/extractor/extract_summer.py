#!/usr/bin/env python3
"""
Stevenson High School Summer School Course Data Generator

Produces data/YYYY-summer-courses.json from manually curated course data
in summer_courses_YYYY.py. The summer school PDF uses a two-column layout
that is unreliable for automated extraction, so courses are curated manually
from the PDF each year.

Usage:
    python extract_summer.py [--year YYYY] [--out-dir DIR]

To update for a new year:
    1. Read the new summer school PDF
    2. Update summer_courses_YYYY.py with the new course data
    3. Run this script to generate the JSON
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from summer_courses_2026 import SUMMER_COURSES_2026

# Map year to curated data
CURATED_DATA = {
    2026: SUMMER_COURSES_2026,
}

# Descriptions extracted from PDF (too long for the data file)
DESCRIPTIONS = {
    "D/E21S": "This course is a two-phase program consisting of classroom and behind-the-wheel instruction. The course prepares students for safe motor vehicle operation in a suburban driving environment. Among the topics taught are: the rules of the road, defensive driving, natural laws and their effects on vehicle control, driver responsibility and impaired and distracted driving.",
    "BUS71S": "Introduction to Business provides students with a foundational understanding of the business world. This course explores key topics including marketing, accounting, international business and entrepreneurship, giving students insight into how businesses operate locally and globally.",
    "BUS12S": "This course focuses on developing essential technology skills needed for success in the business world, emphasizing proficiency in widely-used business applications including spreadsheets, presentations and word processing.",
    "CAR53S": "Careers in Business is a two-week course designed for students interested in learning more about careers in business through classroom visits by professionals, activities and field trips.",
    "CAR35S": "Careers in Law is a two-week course for students wishing to explore careers in law through classroom visits by professionals, activities and field trips.",
    "CAR31S": "Careers in Healthcare and Medicine is a two-week course designed for students who want to explore careers in healthcare through classroom visits by professionals, activities and field trips.",
    "CAR62S": "Careers in STEM is a two-week course designed for students wishing to explore careers in Science, Technology, Engineering and Math through classroom visits by professionals, activities and field trips.",
    "ENG51S": "Students will write college essays/personal statements for multiple college applications. Students will examine model essays, respond to various prompts and discover their writing voices as they develop content and style.",
    "ENG25S": "This writing-intensive course is for students who need to earn English credit due to a failure of either first or second semester. Students will perform a well-rounded set of skills in various activities or remediate particular weaknesses.",
    "ENG71S": "This course emphasizes close analytical reading. Students will read a variety of fiction and nonfiction texts and prepare to discuss, analyze and write about those texts for college-level coursework.",
    "ENG57S": "Creative Writing is designed for students wanting to develop their creative writing skills. Students will write in multiple genres including poetry, fiction, creative nonfiction and screenwriting.",
    "CSC61S": "This course introduces students to the foundations of computer programming using Python. Python's syntax is easy to read and write, making it an ideal language for an introduction to computer science.",
    "CSC82S": "This course is intended for students who possess some programming experience and seek a deeper understanding of computer programming concepts using the Java language.",
    "ART11S": "Students will explore a variety of tools, techniques and media which provides them with the foundation necessary to expand into more specialized areas. Studio activities focus on developing skills in drawing, painting, sculpture and ceramics.",
    "ART31S": "Photography 1 covers basic concepts and practice of digital photography, including understanding and use of the camera, lenses and other basic photographic equipment.",
    "ART51S": "This course introduces students to Adobe Photoshop and Procreate as drawing and graphic design tools and as a means of producing finished artwork.",
    "THR11S": "Theatre Arts introduces students to the fundamentals of theatre including acting, improvisation, movement, voice and basic stagecraft through performance-based activities.",
    "MTH15S": "Algebra 1 helps students develop proficiency in algebraic thinking. Students will explore overarching ideas of patterns of change, mathematical representations, models and solutions.",
    "MTH25S": "Geometry helps students develop proficiency in deductive reasoning and geometric thinking. Students will rely on exploration, conjecture, deduction, justification and abstraction to strengthen their reasoning skills.",
    "MTH51S": "Algebra 2 builds upon students' prior experiences in geometric relationships and deductive reasoning to deepen students' fluency with algebraic thinking.",
    "MTH37S": "Algebra 2 AB/BC attends to all the learning outcomes of Algebra 2. All topics will be substantially extended and students will be introduced to additional mathematical concepts.",
    "ELD11S": "This course is designed to strengthen the literacy and oracy skills of students who are taking or have taken more advanced ELD coursework through an exploration of various texts.",
    "ELD21S": "This course is designed to enrich the academic English skills of incoming students in the ELD program. Students will focus on becoming stronger readers and writers through explorations of supported texts.",
    "ELD32S": "This course for incoming students in the ELD program is designed to build and enrich English skills applicable across content areas and reinforce essential study skills and work habits.",
    "PED21S": "Health Education covers wellness and mental health, adult CPR and AED, fitness and personal health, reality of drugs, and social health. This course is required for graduation.",
    "SCI21S": "Astronomy is the scientific study of the origin, structure and evolution of the universe and the objects in it. Topics include patterns and motions in the sky, gravity and orbits, telescopes and light, planetary systems, and the birth and death of stars.",
    "SCI31S": "Introduction to Biotechnology is a two-week course where students will conduct a variety of labs including the use of PCR, gel electrophoresis, bacterial transformation and CRISPR.",
    "SOC13S": "World History and Geography focuses on disciplinary skills of comprehension, analysis and argumentation while exploring historical and geographic patterns, themes and concepts.",
    "SOC41S": "U.S. History explores the political, social, cultural and economic development of the United States through critical analysis of primary and secondary sources.",
    "SOC33S": "U.S. Government examines the concepts and structure of federal, state and local government. Students develop critical thinking skills for understanding government processes.",
    "SOC43S": "Economics is designed to acquaint students with the economic knowledge and decision-making skills they will need to make rational decisions as informed citizens, responsible consumers and productive workers.",
    "IEN51S": "This survey course will familiarize and instruct special education students in the many reading and writing assignments they will encounter in their coursework at Stevenson.",
    "IJOB2S": "Preparing for Life is designed to provide students with a variety of hands-on learning opportunities to help them acquire the necessary life skills to be as independent as possible.",
    "TCH91S": "Keys to Success will prepare students to cope with the academic expectations of high school and beyond. Specific study skills and strategies for test taking, note taking, research, organization and time management will be applied.",
    "ACTPREPS": "This five-day course will be taught by subject-area instructors and focus on essential skills assessed on the ACT. Students will take two practice ACT tests with immediate feedback.",
}


def main():
    parser = argparse.ArgumentParser(description="Generate summer school course JSON from curated data")
    parser.add_argument("--year", type=int, default=2026, help="Catalog year (default: 2026)")
    parser.add_argument("--out-dir", default=None, help="Output directory (default: data/)")
    args = parser.parse_args()

    if args.year not in CURATED_DATA:
        print(f"ERROR: No curated data for year {args.year}. Available: {list(CURATED_DATA.keys())}")
        sys.exit(1)

    courses = CURATED_DATA[args.year]
    out_dir = args.out_dir or os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(out_dir, exist_ok=True)

    output = {
        "metadata": {
            "source": f"summer_courses_{args.year}.py (manually curated)",
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "year": args.year,
            "type": "summer",
            "total_courses": len(courses),
        },
        "courses": [
            {
                "code": c["code"],
                "all_codes": c["all_codes"],
                "name": c["name"],
                "division": c["division"],
                "department": c["department"],
                "description": DESCRIPTIONS.get(c["code"], ""),
                "credit_value": c["credit_value"],
                "duration": c["duration"],
                "credit_type": c["credit_type"],
                "grade_levels": c["grade_levels"],
                "semesters_offered": c["semesters_offered"],
                "gpa_waiver": c["gpa_waiver"],
                "is_summer": True,
                "prerequisite_text": c["prerequisite_text"],
                "prerequisite_groups": [],
                "cost": c.get("cost"),
            }
            for c in courses
        ],
    }

    out_path = os.path.join(out_dir, f"{args.year}-summer-courses.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Generated {len(courses)} summer courses → {out_path}")
    print()

    by_div = {}
    for c in courses:
        by_div.setdefault(c["division"], []).append(c)
    for div in sorted(by_div):
        print(f"  {div}: {len(by_div[div])} courses")
        for c in by_div[div]:
            print(f"    {c['code']:10s} {c['name']}")


if __name__ == "__main__":
    main()
