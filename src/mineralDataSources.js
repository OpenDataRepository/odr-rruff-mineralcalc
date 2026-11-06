import * as XLSX from "xlsx";
import { amcValenceChemistry } from "./amcChemistry.js";
// A circular import (the parser imports this file), safe because analyze is
// only called inside functions, never while the modules load.
import { analyze } from "./MineralFormulaParser.jsx";

// ---------------------------------------------------------------------------
// Data-source layer: anything that can produce a list of
// { name, formulaStr } rows for the parser to consume. Today only the Excel
// loader is wired up in the UI, but loadMineralsFromApi is ready to point at
// a real database endpoint the moment one exists — swap MINERAL_DATA_SOURCE
// below (or wire up a picker in the UI) without touching the parser itself.
// ---------------------------------------------------------------------------

// The source spreadsheet was assembled from HTML tables in places, so some
// cells carry literal HTML escaping/markup instead of the plain characters
// they represent — e.g. '&lt;' instead of '<', or '<i>n</i>' instead of
// plain 'n'. Decoded once here so every downstream consumer sees plain
// text: this matters beyond just display, since the Type 2 algebraic-bound
// parser (see findVariableBounds in MineralFormulaParser.jsx) needs a
// literal '<' to recognize a bound clause like '(x<0.5)'.
function decodeMarkup(s) {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<\/?i>/gi, "");
}

// Trims/filters raw {name, formulaStr}-ish rows into the canonical shape
// every data source (file, API, hand-typed) is expected to converge on.
export function normalizeMineralRows(rawRows) {
  return (rawRows || [])
    .filter((r) => r && r.name && r.formulaStr)
    .map((r) => ({
      name: decodeMarkup(String(r.name)).trim(),
      formulaStr: decodeMarkup(String(r.formulaStr)).trim(),
    }));
}

// Reads the "Mineral names and valence formula.xlsx" layout: header row,
// then Name in column A, formula in column B. Works for .csv too, but a
// .csv/.txt file has to be routed differently: handed raw bytes (type
// "array"), XLSX.read sniffs it as plain text and decodes it against a
// legacy single-byte codepage rather than UTF-8, so any non-ASCII character
// (e.g. the 'Á' in 'Ángelaite') comes out as mojibake — its multi-byte UTF-8
// encoding gets read back as two separate wrong characters. Decoding the
// bytes as UTF-8 text ourselves first, then handing XLSX.read the resulting
// string (type "string"), sidesteps that guess entirely. A real .xlsx is a
// binary zip archive, not text, so it still has to go through as raw bytes.
export async function loadMineralsFromFile(file) {
  const isPlainText = /\.(csv|txt)$/i.test(file.name);
  const wb = isPlainText
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const parsed = rows.slice(1).map((r) => ({ name: r[0], formulaStr: r[1] }));
  return normalizeMineralRows(parsed);
}

// Writes {name, formulaStr} rows back out in the exact layout
// loadMineralsFromFile reads — header row, then Name/Formula columns — so a
// chosen subset (e.g. just the rows that failed to parse) can be corrected
// and re-uploaded through "Upload .xlsx / .csv" to check them again.
export function exportMineralsToXlsx(rows, filename) {
  const aoa = [["Name", "Formula"], ...rows.map((r) => [r.name, r.formulaStr])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

// Fetches the mineral list from a REST/database API instead of a file.
// Accepts common response shapes out of the box (a bare array, or an
// envelope like { data: [...] } / { minerals: [...] } / { rows: [...] }),
// and a `mapRow` override for whatever field names the real backend uses,
// e.g. mapRow: (r) => ({ name: r.mineral_name, formulaStr: r.valence_formula }).
export async function loadMineralsFromApi(
  endpoint,
  { headers = {}, mapRow, signal } = {}
) {
  const res = await fetch(endpoint, { headers, signal });
  if (!res.ok) {
    throw new Error(`API request to ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const rawRows = Array.isArray(json) ? json : json.data ?? json.minerals ?? json.rows ?? [];
  const rows = rawRows.map(
    mapRow ||
      ((r) => ({
        name: r.name ?? r.mineral ?? r.mineral_name,
        formulaStr: r.formula ?? r.formulaStr ?? r.valence_formula,
      }))
  );
  return normalizeMineralRows(rows);
}

// The plugin's record proxy, or devRecordProxy.js's under "npm run dev".
// Read on use so Node scripts without `document` can import this module.
function recordProxyUrl() {
  return document.getElementById("mineral-parser-root")?.dataset.recordUrl || "/odr_rruff/api/record/";
}

// One ODR record: { fields: [{ field_name, value }], records: [children] }.
export async function loadOdrRecord(uuid, { signal } = {}) {
  const res = await fetch(recordProxyUrl() + encodeURIComponent(uuid), { signal });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // WordPress REST errors carry their reason in `message`.
    throw new Error(json?.message || `Record request failed: ${res.status} ${res.statusText}`);
  }
  if (!json) throw new Error("The record response was not valid JSON");
  return json;
}

// A field's value, or undefined when missing or empty.
export function getRecordField(record, fieldName) {
  const field = record?.fields?.find?.((f) => f.field_name === fieldName);
  if (!field || field.value === undefined || field.value === null || field.value === "") return undefined;
  return String(field.value);
}

// The chemistry computed from the AMC atom table, with its label valences,
// or { error } if the record has no AMC file or it can't be read. The
// record's Chemistry field isn't passed in: it's filled from the original
// CIF, which isn't a reliable source for chemistry, while the AMC file is
// the one edited until the chemistry is right.
// idealFormulaStr (the IMA valence formula) sets the formula's scale, see
// amcChemistry's amcFormulaScale.
// divisor (optional) overrides that scale, see amcValenceChemistry.
function amcValencesOf(record, idealFormulaStr, divisor) {
  const amcText = getRecordField(record, "AMC File Contents");
  if (!amcText) return { error: "The record has no AMC File Contents" };
  try {
    return amcValenceChemistry(amcText, undefined, { idealAtomCount: atomCountWithoutH(idealFormulaStr), divisor });
  } catch (e) {
    return { error: e.message };
  }
}

// A formula's atom count, H left out, or undefined when it doesn't parse.
// A range formula's first end-member is used.
export function atomCountWithoutH(formulaStr) {
  if (!formulaStr) return undefined;
  try {
    const result = analyze(formulaStr);
    const atoms = result?.isRange ? result.columns[0].atoms : result?.atoms;
    return atoms?.filter((a) => a.symbol !== "H").reduce((s, a) => s + a.count, 0);
  } catch {
    return undefined;
  }
}

// A cell from fields named a, b, c, alpha, beta, gamma. parseFloat drops a
// trailing uncertainty, as in "12.0630(2)".
function cellOf(record) {
  const cellField = (name) => parseFloat(getRecordField(record, name));
  return {
    a: cellField("a"),
    b: cellField("b"),
    c: cellField("c"),
    alpha: cellField("alpha"),
    beta: cellField("beta"),
    gamma: cellField("gamma"),
  };
}

// The record as a citation column: the chemistry from its AMC file (the
// Chemistry field only when there's no readable AMC file), cell and journal
// line.
// divisor (optional) is the page's manual scale; the citation's amcScale
// rebuilds it at any other divisor of the symmetry count (see LandingPage).
function amcsdCitationOf(record, idealFormulaStr, divisor) {
  const amcValences = amcValencesOf(record, idealFormulaStr, divisor);
  const formula = amcValences.error ? getRecordField(record, "Chemistry") : amcValences.formulaStr;
  if (!formula) return null;
  const amcLines = (getRecordField(record, "AMC File Contents") || "").split(/\r?\n/);
  return {
    formula,
    cell: cellOf(record),
    // AMC line 3 is the journal.
    citation: (amcLines[2] || getRecordField(record, "Authors") || "").trim(),
    amcValences: amcValences.labelled?.length ? amcValences : null,
    // Only when the formula came from the AMC file (not the Chemistry field).
    amcScale: amcValences.error
      ? null
      : {
          divisor: amcValences.Z,
          divisors: amcValences.divisors,
          symmetryCount: amcValences.symmetryCount,
          scaledToIdeal: amcValences.scaledToIdeal,
          withDivisor: (d) => amcsdCitationOf(record, idealFormulaStr, d),
        },
  };
}

// ODR database UUIDs, as the API reports them in database_uuid.
const IMA_MINERAL_DB = "8737e9e4212f5eac3703aeeb5cae";
const AMCSD_DB = "bf04d8bf310bcf7a1126d2f042c6";
const RRUFF_SAMPLE_DB = "ddc5e9ba834ad596cc31aebb1225";
// Children of a RRUFF sample.
const RRUFF_POWDER_XRD_DB = "a519503f9a1b13329323d8cdb269";
const RRUFF_XRD_REFINEMENT_DB = "77cc5789aaef93181abcfae1c582";
const RRUFF_MICROPROBE_DB = "b4d723b79487a7b45136b0f2a133";

const childrenIn = (record, databaseUuid) =>
  (record?.records || []).filter((child) => child.database_uuid === databaseUuid);

// One column per microprobe analysis with a Measured Chemistry, labelled
// with its RRUFF ID (e.g. R040001.2). The cell is the sample's first
// refined powder XRD cell, when it has one. `probes` defaults to all of the
// sample's analyses.
function rruffSampleCitationsOf(sample, probes = childrenIn(sample, RRUFF_MICROPROBE_DB)) {
  const refinement = childrenIn(sample, RRUFF_POWDER_XRD_DB)
    .flatMap((xrd) => childrenIn(xrd, RRUFF_XRD_REFINEMENT_DB))
    .find((r) => Number.isFinite(parseFloat(getRecordField(r, "a"))));
  const cell = refinement ? cellOf(refinement) : null;
  return probes
    .map((probe) => ({ probe, formula: getRecordField(probe, "Measured Chemistry") }))
    .filter(({ formula }) => formula)
    .map(({ probe, formula }) => ({
      formula,
      cell,
      citation: getRecordField(probe, "Child RRUFF ID") || getRecordField(sample, "RRUFF ID") || "",
    }));
}

// The plugin's RRUFF sample lookup, or devRecordProxy.js's under
// "npm run dev". Resolves to the sample record with that RRUFF ID.
async function loadRruffSample(rruffId, { signal } = {}) {
  const base = document.getElementById("mineral-parser-root")?.dataset.rruffSampleUrl || "/odr_rruff/api/rruff-sample/";
  const res = await fetch(base + encodeURIComponent(rruffId), { signal });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `RRUFF sample request failed: ${res.status} ${res.statusText}`);
  if (!json) throw new Error("The RRUFF sample response was not valid JSON");
  return json;
}

// How each database's records are read for a ?UUID= link, matched by
// database_uuid (AMCSD records have no template_uuid). Each reader resolves
// to { mineralParent, citations }: the name and ideal formula come from the
// IMA mineral, which is mineralParent itself or one of its children. Add a
// database here to support its records.
const RECORD_READERS = [
  {
    databaseUuid: AMCSD_DB,
    label: "AMCSD",
    // A record link is about one sample's analysis, so its column stays even
    // when it matches the ideal formula (see LandingPage's showMatchingWeights).
    showsMatchingColumns: true,
    async read(record) {
      const citation = amcsdCitationOf(record, idealFormulaOf(record));
      if (!citation) throw new Error("The AMCSD record has no readable AMC file and no Chemistry field");
      return { mineralParent: record, citations: [citation] };
    },
    fallbackName: (record) => getRecordField(record, "Mineral"),
  },
  {
    databaseUuid: RRUFF_SAMPLE_DB,
    label: "RRUFF",
    showsMatchingColumns: true,
    // A sample without a microprobe analysis shows the ideal formula alone.
    async read(record) {
      return { mineralParent: record, citations: rruffSampleCitationsOf(record) };
    },
  },
  {
    databaseUuid: RRUFF_MICROPROBE_DB,
    label: "RRUFF microprobe",
    showsMatchingColumns: true,
    // The record doesn't link to its sample, so the sample is looked up by
    // RRUFF ID (R040002.2 -> R040002). Only this analysis is shown.
    async read(record, options) {
      const childId = getRecordField(record, "Child RRUFF ID") || record.record_name || "";
      const sampleId = /^R\d{6}/i.exec(childId)?.[0];
      if (!sampleId) throw new Error(`The microprobe record's RRUFF ID "${childId}" doesn't name a sample`);
      const sample = await loadRruffSample(sampleId, options);
      const citations = rruffSampleCitationsOf(sample, [record]);
      if (citations.length === 0) throw new Error("The microprobe record has no Measured Chemistry");
      return { mineralParent: sample, citations };
    },
  },
  {
    databaseUuid: IMA_MINERAL_DB,
    label: "IMA mineral",
    async read(record) {
      return { mineralParent: record, citations: [] };
    },
  },
];

// The IMA mineral a record belongs to: the record itself, or its child with
// a valence formula.
function imaMineralOf(record) {
  return record.database_uuid === IMA_MINERAL_DB
    ? record
    : childrenIn(record, IMA_MINERAL_DB).find((child) => getRecordField(child, "Valence Formula"));
}

const idealFormulaOf = (record) => {
  const mineral = imaMineralOf(record);
  return mineral && getRecordField(mineral, "Valence Formula");
};

// A ?UUID= link to any record in RECORD_READERS. Resolves to
// { name, formulaStr, citations, source, showsMatchingColumns }.
export async function loadMineralForRecord(uuid, options) {
  const record = await loadOdrRecord(uuid, options);
  const reader = RECORD_READERS.find((r) => r.databaseUuid === record.database_uuid);
  if (!reader) {
    throw new Error(`The record is from database ${record.database_uuid || "(unknown)"}, which the calculator can't read yet`);
  }
  const { mineralParent, citations } = await reader.read(record, options);
  const mineral = imaMineralOf(mineralParent);
  const formulaStr = mineral && getRecordField(mineral, "Valence Formula");
  if (!formulaStr) throw new Error(`The ${reader.label} record has no linked IMA mineral with a valence formula`);
  return {
    name: getRecordField(mineral, "Mineral Name") || reader.fallbackName?.(mineralParent),
    formulaStr,
    citations,
    source: reader.label,
    showsMatchingColumns: Boolean(reader.showsMatchingColumns),
  };
}

// Registry so the UI can offer a source picker without importing every
// loader individually. Add new entries here as new sources come online.
export const MINERAL_DATA_SOURCES = {
  xlsx: { id: "xlsx", label: "Excel / CSV file", load: loadMineralsFromFile },
  api: { id: "api", label: "Database API", load: loadMineralsFromApi },
};
