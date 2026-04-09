-- Allow summer semesters (-2 = Summer Session 1, -1 = Summer Session 2)
-- in plan_courses and grade_entries tables.

ALTER TABLE plan_courses DROP CONSTRAINT IF EXISTS semester_values;
ALTER TABLE plan_courses ADD CONSTRAINT semester_values
  CHECK (semester IN (-2, -1, 1, 2) OR semester IS NULL);

ALTER TABLE grade_entries DROP CONSTRAINT IF EXISTS semester_values;
ALTER TABLE grade_entries ADD CONSTRAINT semester_values
  CHECK (semester IN (-2, -1, 1, 2));
