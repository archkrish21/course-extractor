# Extractor Fidelity Plan

Audit on 2026-05-04 sampled 18 courses across all 12 divisions, all 5 credit types, summer + regular catalog, plus the 4 courses recovered by [#141](https://github.com/archkrish21/course-extractor/pull/141). The course-detail modal pulls course data straight from the DB, which is loaded straight from `saps/extractor/data/2026-courses-with-summer.json` by `saps/extractor/loader.py` — so any defect in that JSON appears verbatim in the modal.

This plan tracks the seven issues opened from that audit and the order in which they will be fixed.

## Issues

| # | Severity | Title | Fix order |
|---|---|---|---|
| [#143](https://github.com/archkrish21/course-extractor/issues/143) | 1 | descriptions corrupted by column-bleed garbage tokens | 3 |
| [#144](https://github.com/archkrish21/course-extractor/issues/144) | 1 | prereq tail bleeds into start of description | 2 |
| [#145](https://github.com/archkrish21/course-extractor/issues/145) | 1 | next course title bleeds into end of description (also fixes wrong `gpa_waiver` flags) | **1** |
| [#146](https://github.com/archkrish21/course-extractor/issues/146) | 1 | `prerequisite_codes` contains false positives from fuzzy text matching | 4 |
| [#147](https://github.com/archkrish21/course-extractor/issues/147) | 2 | summer course descriptions are summarized, not extracted verbatim | 5 |
| [#148](https://github.com/archkrish21/course-extractor/issues/148) | 3 | inconsistent semester-pair representation (slashed vs. split entries) | 6 |
| [#149](https://github.com/archkrish21/course-extractor/issues/149) | 3 | top-level `prerequisite_codes` is partial subset of `prerequisite_groups` | 7 |

## Fix-order rationale

- **#145 first** — affects nearly every multi-course-per-page entry (largest blast radius), and fixes the `gpa_waiver` mis-attribution as a side-effect.
- **#144 next** — likely lives in the same prereq-block parsing region as #145; cheap to land alongside the same regression tests.
- **#143** — column-cropping is a separate page-layout problem.
- **#146** — the prereq-text-to-code matcher is a separate code path.
- **#147** — summer extractor is a different script (or path) entirely.
- **#148, #149** — structural cleanups; defer until correctness is restored.

## Verification harness

After each fix, re-run:
1. `python extract.py <pdf-path> --year 2026 --out-dir ./data` for the regular catalog
2. (For #147) the summer extraction
3. `python loader.py data/2026-courses-with-summer.json --dry-run` against local Supabase
4. Spot-check the courses listed as examples in the corresponding GitHub issue against the source PDFs in `data/`

## Sample courses used in the audit

ART101, ART721/ART722, ART511, CHI351/CHI352, CHI601/CHI602, CSC371/CSC372, PED031, MTH151/MTH152, MTH591, BUS252, BUS411, CAR53S, ENG51S, SCI111/SCI112, SOC101/SOC102, ENG141/ENG142, VOC071/VOC072, SPA351/SPA352, ACTPREPS.

These should be the smoke-test set for any extractor PR.
