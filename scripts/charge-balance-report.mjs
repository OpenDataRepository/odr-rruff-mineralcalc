#!/usr/bin/env node
// Lists every RRUFF microprobe formula whose net charge isn't 0, for the
// samples whose RRUFF ID starts with a prefix (e.g. R04 for R040001-R049999).
// Each formula goes through the same steps the page uses (ideal-formula
// valences, REE substitution, added H), so "Net charge" here is the number
// the page shows in orange. Formulas the page can't read are listed too.
// Fetches the samples live from the RRUFF API with the login in .env (see
// .env.example), one page of search results at a time.
// Usage:
//   node scripts/charge-balance-report.mjs <RRUFF ID prefix> [output.csv]
// Example: node scripts/charge-balance-report.mjs R04
// Output defaults to charge-balance-<prefix>.csv in your Downloads folder.

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { csvCell, defaultReportPath } from "./cellparamsRecords.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://www.rruff.net/odr_rruff/api/v4";
const RRUFF_SAMPLE_DB = "ddc5e9ba834ad596cc31aebb1225";
const RRUFF_ID_FIELD_UUID = "ee88404d73886150b59dd07cbb12";
const PAGE_SIZE = 100;
// Pause between API requests, to keep the load on the site light.
const PAUSE_MS = 1500;
// The page shows a net charge in orange above this.
const TOLERANCE = 0.001;

// The app's modules import .jsx, which Node can't load directly — bundle
// what's needed to a temp file first.
async function loadAppModules() {
  const outfile = join(tmpdir(), `charge-balance-${process.pid}.mjs`);
  await build({
    stdin: {
      contents: `
        export { buildIdealRows, buildEmpiricalRows } from "./src/empiricalFormulaRows.js";
        export { mineralFromRecord } from "./src/mineralDataSources.js";
      `,
      resolveDir: ROOT,
      loader: "js",
    },
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

function readEnv() {
  const values = {};
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const { username, password } = readEnv();
  if (!username || !password) throw new Error("No username / password in .env - copy .env.example to .env and fill it in.");
  const res = await fetch(`${API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  const type = res.headers.get("content-type") || "";
  const token = type.includes("application/json")
    ? ((d) => d.token || d.access_token || d.jwt)(await res.json())
    : (await res.text()).trim();
  if (!token) throw new Error("Login response did not include a token");
  return token;
}

// Every sample whose RRUFF ID starts with prefix. The search matches
// partly, so results are filtered to the prefix.
async function searchSamples(token, prefix) {
  const idPattern = new RegExp(`^${prefix}\\d*$`, "i");
  const samples = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(`${API}/dataset/${RRUFF_SAMPLE_DB}/search/${PAGE_SIZE}/${offset}.json`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_uuid: RRUFF_SAMPLE_DB, fields: [{ field_uuid: RRUFF_ID_FIELD_UUID, value: prefix }] }),
    });
    if (!res.ok) throw new Error(`Sample search failed at offset ${offset}: ${res.status} ${res.statusText}`);
    const records = (await res.json()).records || [];
    samples.push(...records.filter((r) => idPattern.test(String(r.record_name))));
    process.stderr.write(`\rFetched ${offset + records.length} search results…`);
    if (records.length < PAGE_SIZE) break;
    await sleep(PAUSE_MS);
  }
  process.stderr.write("\n");
  return samples;
}

// The formula's anions, e.g. "O, F", to tell oxides from the rest.
const anionsOf = (result) =>
  [...new Set(result.atoms.filter((a) => a.valence < 0).map((a) => a.symbol))].join(", ");

async function main() {
  const prefix = (process.argv[2] || "").toUpperCase();
  if (!/^R\d{1,6}$/.test(prefix)) {
    console.error("Usage: node scripts/charge-balance-report.mjs <RRUFF ID prefix, e.g. R04> [output.csv]");
    process.exit(1);
  }
  const outPath = process.argv[3] || defaultReportPath(`charge-balance-${prefix}.csv`);
  const { buildIdealRows, buildEmpiricalRows, mineralFromRecord } = await loadAppModules();

  const samples = await searchSamples(await login(), prefix);
  samples.sort((a, b) => String(a.record_name).localeCompare(String(b.record_name)));

  const header = ["RRUFF ID", "Mineral", "Problem", "Net charge", "Anions", "Measured Chemistry", "Formula as calculated", "IMA ideal formula"];
  const lines = [header.map(csvCell).join(",")];
  let checked = 0;
  let flagged = 0;
  const noMineral = [];

  for (const sample of samples) {
    let mineral;
    try {
      mineral = await mineralFromRecord(sample);
    } catch (e) {
      noMineral.push(`${sample.record_name}: ${e.message}`);
      continue;
    }
    const idealRows = buildIdealRows(mineral.name, mineral.formulaStr);
    const { rows, errors } = buildEmpiricalRows(mineral.name, mineral.citations, idealRows, mineral.formulaStr);
    const measured = Object.fromEntries(mineral.citations.map((c) => [c.citation, c.formula]));
    for (const r of rows) {
      checked++;
      if (Math.abs(r.result.netCharge) <= TOLERANCE) continue;
      flagged++;
      lines.push(
        [r.citation, mineral.name, "Not charge balanced", r.result.netCharge.toFixed(3), anionsOf(r.result),
          measured[r.citation], r.formulaStr, mineral.formulaStr].map(csvCell).join(",")
      );
    }
    for (const e of errors) {
      flagged++;
      lines.push(
        [e.citation, mineral.name, `Can't be read: ${e.bracketProblem?.message || e.error}`, "", "",
          e.formula, "", mineral.formulaStr].map(csvCell).join(",")
      );
    }
  }

  writeFileSync(outPath, lines.join("\r\n") + "\r\n");
  console.log(`${samples.length} ${prefix} samples, ${checked} microprobe formulas checked, ${flagged} flagged.`);
  if (noMineral.length) console.log(`Skipped (no IMA mineral with a valence formula):\n  ${noMineral.join("\n  ")}`);
  console.log(`Report: ${outPath}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
