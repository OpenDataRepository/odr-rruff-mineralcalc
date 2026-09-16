// Loads RRUFF's own cellparams_data.js / cellparams_data_update.js scripts
// directly from the same origin the plugin is embedded on, and reads one
// mineral's records out of the `cellparams` global those scripts populate —
// same field layout as scripts/lookup-cellparams.mjs, which parses the same
// files offline. Because this is same-origin (confirmed: the IMA Mineral
// List page and this plugin run on the same domain), there's no CORS
// concern and no server hop to build; the browser's own HTTP cache absorbs
// repeat loads, since a visitor arriving via that page's button typically
// already fetched these exact scripts moments earlier.
const CELLPARAMS_SCRIPT_URLS = [
  "/odr_rruff/uploads/IMA/cellparams_data.js",
  "/odr_rruff/uploads/IMA/cellparams_data_update.js",
];

const FIELDS = [
  "recordType", "id", "mineralName", "idealFormula", "empiricalFormula",
  "a", "b", "c", "alpha", "beta", "gamma", "volume", "temperature", "pressure",
  "z", "pointGroup", "spaceGroup", "latticeType", "referenceB64", "downloadUrl",
  "extra", "localityB64",
];

let loadPromise = null;

// cellparams_data.js and cellparams_data_update.js assume three globals
// already exist — on rruff.net itself, ima-mineral-list-public.js declares
// them (as `let ... = [];`) before ever loading these data scripts, which
// only do bare `identifier['key'] = ...`/`= 'true'`, no declarations of
// their own. Confirmed by grepping the actual file for every bare
// bracket-assignment target: cellparams, rruff_record_exists, and
// amcsd_record_exists — miss even one and the data script throws a
// ReferenceError partway through and silently stops executing every line
// after it (verified: without amcsd_record_exists pre-declared, only 3 of
// Abellaite's 6 records loaded, and everything past that point in the
// 32k-line file never ran). Since this plugin doesn't load that script,
// all three have to be created here first, as real `window` properties so
// the plain (non-module) data scripts' unqualified references resolve to
// them.
function ensureGlobalsInitialized() {
  window.cellparams = window.cellparams || {};
  window.rruff_record_exists = window.rruff_record_exists || {};
  window.amcsd_record_exists = window.amcsd_record_exists || {};
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// Loads both scripts once per page session; later calls reuse the same
// promise instead of re-injecting the <script> tags.
function ensureCellparamsLoaded() {
  if (!loadPromise) {
    ensureGlobalsInitialized();
    loadPromise = (async () => {
      for (const url of CELLPARAMS_SCRIPT_URLS) {
        await loadScript(url);
      }
    })();
  }
  return loadPromise;
}

// atob() only undoes the base64 encoding — it hands back one byte per
// character (Latin-1), but the underlying text is UTF-8, so any multi-byte
// character (ü, é, ñ, ...) comes out as mojibake (e.g. "für" -> "fÃ¼r").
// Re-decoding those raw bytes as UTF-8 gives the real text back, matching
// what Node's Buffer.from(s, "base64").toString("utf8") already does in
// scripts/lookup-cellparams.mjs.
function decodeB64(s) {
  if (!s) return "";
  try {
    const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return s;
  }
}

function parseRecord(raw) {
  const parts = raw.split("|");
  const record = {};
  FIELDS.forEach((name, i) => {
    record[name] = parts[i] ?? "";
  });
  record.reference = decodeB64(record.referenceB64);
  return record;
}

// Resolves to { mineralName, citations } for the given RRUFF cellparams
// outer hash key (see scripts/lookup-cellparams.mjs), or null if that key
// has no records in either script. `citations` is already in the
// {formula, cell, citation} shape EmpiricalFormulasPage.jsx's
// buildEmpiricalRows expects.
export async function loadCitationsForMineral(mineralId) {
  await ensureCellparamsLoaded();
  const group = window.cellparams && window.cellparams[mineralId];
  if (!group) return null;

  const records = Object.values(group).map(parseRecord);
  const citations = records
    .map((record) => ({
      formula: record.empiricalFormula,
      cell: {
        a: parseFloat(record.a),
        b: parseFloat(record.b),
        c: parseFloat(record.c),
        alpha: parseFloat(record.alpha),
        beta: parseFloat(record.beta),
        gamma: parseFloat(record.gamma),
      },
      citation: record.reference,
    }))
    .filter((row) => row.formula);

  return { mineralName: records[0]?.mineralName || "", citations };
}
