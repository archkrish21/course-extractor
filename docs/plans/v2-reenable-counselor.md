# Re-enable counselor role (post-v1)

The counselor role was hidden from the UI for the v1 release while leaving the backend (Zod schemas, DB enums, `counselorStudentLinks` table, permission gates, seeded E2E user) fully intact. To restore the role, revert the four UI removals and un-skip the paused tests.

## Re-enable checklist

Grep `v1-hide:` across the repo to find every touch point.

### UI (add back the counselor option)

- `saps/app/(auth)/signup/page.tsx` — restore `{ value: "counselor", label: "Counselor", desc: "Guide students" }` in the `ROLES` array.
- `saps/app/(auth)/profile-setup/page.tsx` — same.
- `saps/app/(app)/settings/page.tsx` — restore `<option value="counselor">Counselor</option>` in the invite-role `<select>`.

### Marketing copy

- `saps/app/(public)/page.tsx` — restore the counselor testimonial slot and the "Family & counselor access" feature blurb (replacing the current "Family access" / student-voice testimonial).
- `saps/app/privacy/page.tsx` — role enumeration back to `(student/parent/counselor)`.

### Docs (remove the v1 postponement banners)

- `docs/product/EXECUTIVE_SUMMARY.md`
- `docs/product/PRODUCT_REQUIREMENTS.md`
- `docs/product/FEATURE_ANALYSIS.md`
- `docs/architecture/TECH_DESIGN_DOC.md`
- `docs/architecture/architecture.md`

Each has a `> **v1 scope note:**` blockquote near the top that points to this file — delete it.

### Tests (switch `.skip` back to live)

- `saps/tests/e2e/journeys/counselor-view-only.spec.ts` — `test.describe.skip` → `test.describe`.
- `saps/tests/unit/counselor-restrictions.test.tsx` — `describe.skip` → `describe`.
- `saps/tests/api/counselor-join.test.ts` — `describe.skip` → `describe`.
- `saps/tests/api/plan-shares.test.ts` — two `it.skip` → `it`.
- `saps/tests/e2e/api/plans.spec.ts` — one `test.skip` → `test`.

### Verification

- Sign up as a counselor; confirm role card appears.
- Invite a counselor from settings; confirm they join with `canEdit: false` and view-only share defaults.
- Run the previously-skipped suites and confirm green.
