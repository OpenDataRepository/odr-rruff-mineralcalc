// Shared record loading for the report scripts: reads cellparams_data.js and,
// if it's there, cellparams_data_update.js next to it, the same way the
// browser does (src/cellparamsLoader.js) — main file first, update file
// second, and a later assignment to the same record replaces the earlier
// one. The main file itself assigns some records more than once, so this is
// also what keeps a report from listing the same record twice.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

// Where a report goes when no output path is given: the user's Downloads
// folder, or the current directory if there isn't one.
export function defaultReportPath(fileName) {
  const downloads = join(homedir(), "Downloads");
  return existsSync(downloads) ? join(downloads, fileName) : fileName;
}

export const FIELDS = [
  "recordType", "id", "mineralName", "idealFormula", "empiricalFormula",
  "a", "b", "c", "alpha", "beta", "gamma", "volume", "temperature", "pressure",
  "z", "pointGroup", "spaceGroup", "latticeType", "referenceB64", "downloadUrl",
  "extra", "localityB64",
];

const LINE_RE = /cellparams\['([^']+)'\]\['([^']+)'\] = "((?:[^"\\]|\\.)*)";/g;

export function decodeB64(s) {
  if (!s) return "";
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return s;
  }
}

export function csvCell(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Returns { records, files }: records is every unique record as
// { outerKey, innerKey, ...FIELDS, reference }, files is the list of files
// actually read.
export function loadCellparamsRecords(mainFile) {
  const updateFile = join(dirname(mainFile), "cellparams_data_update.js");
  const files = [mainFile, ...(existsSync(updateFile) ? [updateFile] : [])];
  const byKey = new Map();
  for (const file of files) {
    for (const [, outerKey, innerKey, raw] of readFileSync(file, "utf8").matchAll(LINE_RE)) {
      const parts = raw.split("|");
      const record = { outerKey, innerKey };
      FIELDS.forEach((name, i) => {
        record[name] = parts[i] ?? "";
      });
      record.reference = decodeB64(record.referenceB64);
      byKey.set(`${outerKey}|${innerKey}`, record);
    }
  }
  return { records: [...byKey.values()], files };
}
