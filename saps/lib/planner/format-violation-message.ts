/**
 * Reformats validator violation messages for display: name-primary with the
 * course code surfaced as a tooltip. Two paths:
 *
 *   1. Prerequisite / corequisite — rebuild from missingPrerequisites so OR
 *      lists collapse on identical names (e.g. CSC181/CSC82S/CSC182, all
 *      "Computer Programming 2", become a single chip with three codes in
 *      the tooltip). Drops the trailing "(requirement group N)".
 *
 *   2. Everything else — substitute any course code in the validator's
 *      message with the corresponding name chip. Defensively strips a
 *      trailing requirement-group suffix if present.
 *
 * Returns an array of segments so the renderer can wrap each name with a
 * code tooltip. A single string output would mean the UI has to re-parse,
 * which is the regex-fragility problem we're avoiding.
 */

export type MessageSegment =
  | { kind: "text"; text: string }
  | { kind: "name"; name: string; codes: string[] };

interface FormatArgs {
  type: string;
  message: string;
  targetName: string;
  targetCode: string;
  missingPrerequisites?: Array<{ code: string; name: string }>;
  referencedCourses?: Array<{ code: string; name: string }>;
}

const REQUIREMENT_GROUP_SUFFIX = /\s*\((?:requirement|co-requisite) group \d+\)/;

export function formatViolation(args: FormatArgs): MessageSegment[] {
  if (
    (args.type === "prerequisite" || args.type === "corequisite") &&
    args.missingPrerequisites &&
    args.missingPrerequisites.length > 0
  ) {
    return buildPrereqSegments(args);
  }
  return parseAndSwap(args);
}

function buildPrereqSegments(args: FormatArgs): MessageSegment[] {
  const tail =
    args.type === "corequisite"
      ? " to be taken in the same semester."
      : " to be completed in an earlier semester.";

  const grouped = dedupByName(args.missingPrerequisites ?? []);
  const segments: MessageSegment[] = [
    { kind: "name", name: args.targetName, codes: [args.targetCode] },
    { kind: "text", text: " requires " },
  ];
  grouped.forEach((g, i) => {
    segments.push({ kind: "name", name: g.name, codes: g.codes });
    if (i < grouped.length - 1) {
      segments.push({ kind: "text", text: " or " });
    }
  });
  segments.push({ kind: "text", text: tail });
  return segments;
}

function parseAndSwap(args: FormatArgs): MessageSegment[] {
  const cleaned = args.message.replace(REQUIREMENT_GROUP_SUFFIX, "");

  const all: Array<{ code: string; name: string }> = [
    { code: args.targetCode, name: args.targetName },
    ...(args.referencedCourses ?? []),
    ...(args.missingPrerequisites ?? []),
  ];

  // Code -> name (first wins on duplicate codes).
  const codeToName = new Map<string, string>();
  for (const c of all) {
    if (c.code && !codeToName.has(c.code)) codeToName.set(c.code, c.name);
  }
  if (codeToName.size === 0) return [{ kind: "text", text: cleaned }];

  // Longest-first so composite codes like SOC101/SOC102 win over a hypothetical
  // SOC101 entry.
  const codes = Array.from(codeToName.keys()).sort((a, b) => b.length - a.length);
  const escaped = codes.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = cleaned.split(re);

  const segments: MessageSegment[] = [];
  for (const p of parts) {
    if (p.length === 0) continue;
    if (codeToName.has(p)) {
      segments.push({ kind: "name", name: codeToName.get(p) ?? p, codes: [p] });
    } else {
      segments.push({ kind: "text", text: p });
    }
  }
  return segments.length > 0 ? segments : [{ kind: "text", text: cleaned }];
}

function dedupByName(
  items: Array<{ code: string; name: string }>,
): Array<{ name: string; codes: string[] }> {
  // Keep the first-seen casing for display; group codes by case-insensitive
  // name so SOC101/SOC102 and SOC13S/SOC14S (which can disagree in catalog
  // casing — "WORLD HISTORY..." vs "World History...") collapse to one chip.
  const map = new Map<string, { name: string; codes: string[] }>();
  for (const it of items) {
    const key = it.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      if (it.code && !existing.codes.includes(it.code)) {
        existing.codes.push(it.code);
      }
    } else {
      map.set(key, { name: it.name, codes: it.code ? [it.code] : [] });
    }
  }
  return Array.from(map.values());
}
