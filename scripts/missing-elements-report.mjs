#!/usr/bin/env node
// Lists every RRUFF citation (empirical) formula that's missing an element its
// mineral's IMA ideal formula requires — the same check page 1 shows as
// "missing ..." next to a citation (see requiredElementsOf/missingElements in
// src/empiricalFormulaRows.js). Runs the app's own code, bundled on the fly
// with esbuild, so the report always matches what the page shows. Reads
// cellparams_data_update.js too, if it sits next to the main file (see
// cellparamsRecords.mjs).
// Usage:
//   node scripts/missing-elements-report.mjs [path-to-cellparams_data.js] [output.csv]
// Defaults: public/odr_rruff/uploads/IMA/cellparams_data.js -> missing-elements-report.csv in your Downloads folder

import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { loadCellparamsRecords, csvCell, defaultReportPath } from "./cellparamsRecords.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// empiricalFormulaRows.js imports MineralFormulaParser.jsx, which Node can't
// load directly — bundle it to a temp file first.
async function loadRowBuilders() {
  const outfile = join(tmpdir(), `missing-elements-${process.pid}.mjs`);
  await build({
    entryPoints: [join(ROOT, "src", "empiricalFormulaRows.js")],
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    outfile,
    logLevel: "warning",
  });
  try {
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(outfile, { force: true });
  }
}

async function main() {
  const [
    file = join(ROOT, "public", "odr_rruff", "uploads", "IMA", "cellparams_data.js"),
    outPath = defaultReportPath("missing-elements-report.csv"),
  ] = process.argv.slice(2);
  const { buildIdealRows, buildEmpiricalRows } = await loadRowBuilders();

  const { records, files } = loadCellparamsRecords(file);
  const header = [
    "Mineral", "Missing elements", "H added from ideal", "IMA ideal formula",
    "Empirical formula (as used)", "Empirical formula (RRUFF)", "Reference", "Mineral ID", "Record ID",
  ];
  const lines = [header.map(csvCell).join(",")];
  let checked = 0;
  let unparseable = 0;
  const minerals = new Set();

  for (const r of records) {
    if (!r.empiricalFormula) continue;

    const rows = buildEmpiricalRows(
      r.mineralName,
      [{ formula: r.empiricalFormula, cell: null, citation: "" }],
      buildIdealRows(r.mineralName, r.idealFormula),
      r.idealFormula
    );
    if (!rows.length) {
      unparseable++;
      continue;
    }
    checked++;

    const row = rows[0];
    // H that was filled in from the ideal formula was still missing from
    // the citation itself, so it's reported here too.
    const missing = row.hydrogenAdded != null ? ["H", ...row.missingElements] : row.missingElements;
    if (!missing.length) continue;

    minerals.add(r.mineralName);
    lines.push(
      [
        r.mineralName,
        missing.join(" "),
        row.hydrogenAdded ?? "",
        r.idealFormula,
        row.formulaStr,
        r.empiricalFormula,
        r.reference,
        r.outerKey,
        r.innerKey,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  // BOM so Excel opens it as UTF-8 (mineral names like Zincohögbomite).
  writeFileSync(outPath, "﻿" + lines.join("\r\n") + "\r\n", "utf8");
  console.log(`Read ${files.join(" + ")}`);
  console.log(
    `Checked ${checked} citation formulas (${unparseable} skipped as unparseable): ` +
      `${lines.length - 1} missing elements, across ${minerals.size} minerals. Wrote ${resolve(outPath)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
