import fs from "fs";

const ts = fs.readFileSync("config/seeds/plan-templates.ts", "utf8");
const tRe = /name:\s*"([^"]+)",[\s\S]*?courses:\s*\[([\s\S]*?)\]\s*,?\s*\n\s*\},/g;
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

let mt;
const blocks = [];
while ((mt = tRe.exec(ts))) {
  const name = mt[1];
  const cRe = /\{\s*code:\s*"([^"]+)",\s*grade_level:\s*(\d+),\s*semester:\s*(null|-?\d+)\s*\}/g;
  let cm;
  const rows = [];
  while ((cm = cRe.exec(mt[2]))) {
    const code = cm[1], g = +cm[2], sem = cm[3];
    if (sem === "null") { rows.push([code, g, 1]); rows.push([code, g, 2]); }
    else rows.push([code, g, +sem]);
  }
  blocks.push({ name, rows });
}

let sql = "-- Re-seed plan templates in the Supabase SQL Editor.\n";
sql += "-- Generated from config/seeds/plan-templates.ts.\n";
sql += "-- Affects is_template plans ONLY; student plans (is_template=false) are untouched.\n";
sql += "-- Courses are matched by code within each template plan's catalog_version_id.\n";
sql += "BEGIN;\n";

for (const b of blocks) {
  const vals = b.rows.map((r, i) => `    (${q(r[0])}, ${r[1]}, ${r[2]}, ${i})`).join(",\n");
  sql += `\n-- ===== ${b.name} (${b.rows.length} rows) =====\n`;
  sql += `DELETE FROM plan_courses\n  WHERE plan_id = (SELECT id FROM four_year_plans WHERE name = ${q(b.name)} AND is_template = true);\n`;
  sql += `INSERT INTO plan_courses (plan_id, course_id, grade_level, semester, status, display_order)\n`;
  sql += `  SELECT p.id, c.id, t.grade_level, t.semester, 'planned', t.ord\n`;
  sql += `  FROM four_year_plans p\n`;
  sql += `  JOIN (VALUES\n${vals}\n  ) AS t(code, grade_level, semester, ord) ON TRUE\n`;
  sql += `  JOIN courses c ON c.code = t.code AND c.catalog_version_id = p.catalog_version_id\n`;
  sql += `  WHERE p.name = ${q(b.name)} AND p.is_template = true;\n`;
}
sql += "\nCOMMIT;\n";

fs.writeFileSync("templates-update.sql", sql);
console.log(`wrote templates-update.sql (${blocks.length} templates, ${blocks.reduce((a, b) => a + b.rows.length, 0)} rows)`);
