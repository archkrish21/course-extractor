# Extractor Fidelity Plan

**Status: complete (2026-05-05).** All seven audit-discovered issues plus two follow-ups surfaced during DB load are resolved on `main`.

Audit on 2026-05-04 sampled 18 courses across all 12 divisions, all 5 credit types, summer + regular catalog, plus the 4 courses recovered by [#141](https://github.com/archkrish21/course-extractor/pull/141). The course-detail modal pulls course data straight from the DB, which is loaded straight from `saps/extractor/data/2026-courses-with-summer.json` by `saps/extractor/loader.py` — so any defect in that JSON appears verbatim in the modal.

## Issues and resolutions

| Issue | Title | Closed by |
|---|---|---|
| [#143](https://github.com/archkrish21/course-extractor/issues/143) | descriptions corrupted by column-bleed garbage tokens | [#152](https://github.com/archkrish21/course-extractor/pull/152) |
| [#144](https://github.com/archkrish21/course-extractor/issues/144) | next course title bleeds into end of description | [#150](https://github.com/archkrish21/course-extractor/pull/150) |
| [#145](https://github.com/archkrish21/course-extractor/issues/145) | prereq tail bleeds into start of description | [#151](https://github.com/archkrish21/course-extractor/pull/151) |
| [#146](https://github.com/archkrish21/course-extractor/issues/146) | inconsistent semester-pair representation | [#156](https://github.com/archkrish21/course-extractor/pull/156) (doc + tests; rule was already followed) |
| [#147](https://github.com/archkrish21/course-extractor/issues/147) | top-level `prerequisite_codes` is partial subset of `prerequisite_groups` | [#155](https://github.com/archkrish21/course-extractor/pull/155) |
| [#148](https://github.com/archkrish21/course-extractor/issues/148) | summer course descriptions are summarized, not extracted verbatim | [#154](https://github.com/archkrish21/course-extractor/pull/154) |
| [#149](https://github.com/archkrish21/course-extractor/issues/149) | `prerequisite_codes` contains false positives from fuzzy text matching | [#153](https://github.com/archkrish21/course-extractor/pull/153) |

> Note: GitHub auto-close trailers in some PR descriptions referenced the wrong issue number. The mapping above reflects the **content-fix** correspondence verified against PR diffs. Issue [#149](https://github.com/archkrish21/course-extractor/issues/149) may still appear OPEN on GitHub even though [#153](https://github.com/archkrish21/course-extractor/pull/153)'s diff fully addresses it.

### Follow-ups discovered after the original audit

| PR | Surfaced by | Fix |
|---|---|---|
| [#157](https://github.com/archkrish21/course-extractor/pull/157) | `loader.py --dry-run` rejected the post-audit catalog with TEC401 ↔ TEC351 cycles | Treat catalog punctuation (`–`, `—`, `,`, `/`, `()`, `.`) as a right-side word boundary in `_names_match_strictly`; drop ambiguous matches (multiple stored-name candidates) instead of picking one. |
| [#158](https://github.com/archkrish21/course-extractor/pull/158) | User-reported: ART401–512 descriptions started with "check out…" or "however,…" | Multi-line `Note:` block was bleeding its wrap continuation. End the metadata block when a line starting with a capital letter immediately follows a line ending with `. ! ?`. |

## Net catalog impact

Comparing the post-audit `2026-courses-with-summer.json` against the pre-audit baseline:

- **~215 of 391 descriptions** materially cleaner (next-title bleed removed, prereq tail removed, mid-text column scraps removed, `Note:` continuation removed, summer entries 3-4× longer with verbatim PDF text).
- **15 wrong flags corrected** — 7 `gpa_waiver` (BUS351, BUS411/412, PED031/032, PED201/202) and 8 `is_dual_credit` (CHI351/352, DNC401/402, FCS231/232, FCS311/312, LAT211/212, THR212).
- **46 false-positive prereq links removed** (CHI601 ↔ ENG141, SPA351 ↔ CHI351, etc.) and **22 missing links restored** for bullet-list courses (BUS411 now lists all 13 options at top level).
- **Prereq DAG validates** with 734 nodes and zero cycles.
- **Course count, validation, and existing test suite** all unchanged. ~50 new regression tests guarding the audited cases plus catalog-wide invariants for future extraction runs.

## Verification harness

For any future extractor change, re-run:

1. `python extract.py <pdf-path> --year 2026 --out-dir ./data` (regular catalog)
2. `python extract_summer.py --year 2026 --out-dir ./data` (summer)
3. Re-merge into `data/2026-courses-with-summer.json`
4. `python -m pytest tests/test_extract.py -q` — 100+ tests, 2 pre-existing `credit_value` failures unchanged
5. `python loader.py data/2026-courses-with-summer.json --dry-run` against local Supabase — DAG must validate cleanly
6. Spot-check the smoke-test set below against the source PDFs in `data/`

## Smoke-test sample (use this set for any extractor PR review)

ART101, ART401, ART411, ART501, ART511, ART721/ART722, BUS252, BUS411, CHI351/CHI352, CHI411/CHI412, CHI601/CHI602, CSC371/CSC372, ENG141/ENG142, MTH151/MTH152, MTH591, PED031, SCI111/SCI112, SOC101/SOC102, SPA351/SPA352, TEC301/TEC302, TEC351/TEC352, VOC071/VOC072, CAR53S, ACTPREPS, ENG51S.
