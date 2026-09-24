#!/usr/bin/env node
// Lists every RRUFF citation (empirical) formula that writes rare earths
// generically — "RE", "REE", or "TR" (the Russian-literature abbreviation) —
// instead of naming a specific element. Reads cellparams_data_update.js too,
// if it sits next to the main file (see cellparamsRecords.mjs).
// Usage:
//   node scripts/generic-ree-report.mjs [path-to-cellparams_data.js] [output.csv]
// Defaults: public/odr_rruff/uploads/IMA/cellparams_data.js -> generic-ree-report.csv in your Downloads folder

import { writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCellparamsRecords, csvCell, defaultReportPath } from "./cellparamsRecords.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// A standalone token, not part of a longer symbol — e.g. the "RE" in
// "Re" (rhenium) or "TRi..." never matches. REE is tried before RE so
// "REE" isn't read as "RE" plus a stray "E".
const GENERIC_REE_RE = /(?<![A-Za-z])(REE|RE|TR)(?![a-z])/g;

function main() {
  const [
    file = join(ROOT, "public", "odr_rruff", "uploads", "IMA", "cellparams_data.js"),
    outPath = defaultReportPath("generic-ree-report.csv"),
  ] = process.argv.slice(2);

  const { records, files } = loadCellparamsRecords(file);
  const header = ["Mineral", "Generic token(s)", "IMA ideal formula", "Empirical formula", "Reference", "Mineral ID", "Record ID"];
  const lines = [header.map(csvCell).join(",")];
  const countByToken = { RE: 0, REE: 0, TR: 0 };
  const minerals = new Set();

  for (const r of records) {
    const tokens = [...new Set([...r.empiricalFormula.matchAll(GENERIC_REE_RE)].map((m) => m[1]))];
    if (!tokens.length) continue;

    tokens.forEach((t) => countByToken[t]++);
    minerals.add(r.mineralName);
    lines.push(
      [r.mineralName, tokens.join(" "), r.idealFormula, r.empiricalFormula, r.reference, r.outerKey, r.innerKey]
        .map(csvCell)
        .join(",")
    );
  }

  // BOM so Excel opens it as UTF-8.
  writeFileSync(outPath, "﻿" + lines.join("\r\n") + "\r\n", "utf8");
  console.log(`Read ${files.join(" + ")}`);
  console.log(
    `${lines.length - 1} empirical formulas across ${minerals.size} minerals ` +
      `(RE: ${countByToken.RE}, REE: ${countByToken.REE}, TR: ${countByToken.TR}). Wrote ${resolve(outPath)}`
  );
}

main();
