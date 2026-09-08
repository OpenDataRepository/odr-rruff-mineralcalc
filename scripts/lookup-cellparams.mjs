#!/usr/bin/env node
// Look up RRUFF cellparams records by outer UUID (mineral group) or mineral name.
// Usage:
//   node scripts/lookup-cellparams.mjs uuid 874f6d51e1b144176646454023a1
//   node scripts/lookup-cellparams.mjs name Abellaite

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const FIELDS = [
  "recordType", "id", "mineralName", "idealFormula", "empiricalFormula",
  "a", "b", "c", "alpha", "beta", "gamma", "volume", "temperature", "pressure",
  "z", "pointGroup", "spaceGroup", "latticeType", "referenceB64", "downloadUrl",
  "extra", "localityB64",
];

const LINE_RE = /cellparams\['([^']+)'\]\['([^']+)'\] = "((?:[^"\\]|\\.)*)";/;

function decodeB64(s) {
  if (!s) return "";
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return s;
  }
}

function parseRecord(outerKey, innerKey, raw) {
  const parts = raw.split("|");
  const record = { outerKey, innerKey };
  FIELDS.forEach((name, i) => {
    record[name] = parts[i] ?? "";
  });
  record.reference = decodeB64(record.referenceB64);
  record.locality = decodeB64(record.localityB64);
  return record;
}

async function main() {
  const [mode, query, file = "cellparams_data.js"] = process.argv.slice(2);
  if (!mode || !query || !["uuid", "name"].includes(mode)) {
    console.error("Usage: node scripts/lookup-cellparams.mjs <uuid|name> <value> [path-to-cellparams_data.js]");
    process.exit(1);
  }

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  const matches = [];

  for await (const line of rl) {
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const [, outerKey, innerKey, raw] = m;
    if (mode === "uuid" && outerKey !== query) continue;
    const record = parseRecord(outerKey, innerKey, raw);
    if (mode === "name" && record.mineralName.toLowerCase() !== query.toLowerCase()) continue;
    matches.push(record);
  }

  console.log(JSON.stringify(matches, null, 2));
  console.error(`\n${matches.length} record(s) found.`);
}

main();
