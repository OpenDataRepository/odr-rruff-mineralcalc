import { analyze } from "./MineralFormulaParser.jsx";
import { UNKNOWN_MULTIPLIER_RE } from "./empiricalFormulaRows.js";
import { parseChemicalFormula, isFormulaFormatted } from "./odrChemistryFormat.js";

// The metrics page's numbers: for every mineral on the IMA list, its ideal
// formula and each of its citations' actual (empirical) formulas from
// RRUFF's cellparams data are run, each on its own,
// through the same analyze() the rest of the app uses, and each formula
// gets a few facts — is it one exact composition, do its whole-number
// amounts share a common divisor, does it charge balance, does it have O.
// The page then counts those facts for the ideal formulas and the
// empirical ones side by side.

// A net charge this close to zero counts as balanced — enough to absorb
// rounding in a citation's decimal amounts without hiding a real imbalance.
export const BALANCE_TOLERANCE = 0.01;

// Why a formula doesn't give one exact composition, or null if it does.
// Checked in this order, so each formula gets the first reason that fits.
export const IMPRECISE_REASONS = {
  unparseable: "Doesn't parse",
  unknownMultiplier: "Unknown multiplier (n, x, y)",
  sharedSite: "Shared site, e.g. (Fe,Mg)",
  range: "Range or variable amount",
};

// A comma other than the ',REE' form (which the parser resolves to one
// named element, so it's still exact).
const hasSharedSite = (formulaStr) => (formulaStr || "").replace(/,REE/g, "").includes(",");

function imprecisionReason(formulaStr, columns, isModifiedIdeal) {
  if (!columns.length) return "unparseable";
  if (UNKNOWN_MULTIPLIER_RE.test(formulaStr)) return "unknownMultiplier";
  if (isModifiedIdeal || (columns.length > 1 && hasSharedSite(formulaStr))) return "sharedSite";
  if (columns.length > 1) return "range";
  return null;
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

// The largest number every element's amount divides by (e.g. 2 for
// Ce2P10O30N4), or null when an amount isn't a whole number. Amounts are
// summed per element first, so O in (CO3)2(OH) counts once as O7.
function commonDivisor(atoms) {
  const totals = {};
  for (const a of atoms) totals[a.symbol] = (totals[a.symbol] || 0) + a.count;
  const counts = Object.values(totals).map((c) => Math.round(c * 1e6) / 1e6);
  if (!counts.length || counts.some((c) => !Number.isInteger(c) || c <= 0)) return null;
  return counts.reduce(gcd);
}

// Facts shared by ideal and empirical formulas, from their analyzed
// column(s): one column for an exact formula, two end-members otherwise.
// `error` is the parser's message when the formula didn't parse.
// `modifiedIdeal` marks a formula with more than one shared site, which the
// calculator only approximates by keeping each site's first element (see
// expandCommaGroup in MineralFormulaParser.jsx).
function formulaFacts(formulaStr, columns, isModifiedIdeal, error) {
  const reason = imprecisionReason(formulaStr, columns, isModifiedIdeal);
  if (!columns.length) return { formulaStr, reason, error, balanced: null };
  const netCharges = columns.map((c) => c.netCharge);
  // Native metals have no meaningful charge (see isMetallicFormula), so
  // they're left out of the balance counts rather than counted as balanced.
  const metallic = columns.every((c) => c.isMetallic);
  return {
    formulaStr,
    reason,
    modifiedIdeal: Boolean(isModifiedIdeal),
    divisor: reason ? null : commonDivisor(columns[0].atoms),
    hasOxygen: columns.some((c) => c.atoms.some((a) => a.symbol === "O")),
    netCharge: netCharges.reduce((worst, n) => (Math.abs(n) > Math.abs(worst) ? n : worst), 0),
    balanced: metallic ? null : netCharges.every((n) => Math.abs(n) < BALANCE_TOLERANCE),
  };
}

// Analyzes one formula on its own, as written: { columns, isModifiedIdeal,
// error }. Nothing from any other formula goes into it.
function analyzeAsWritten(name, formulaStr) {
  try {
    const result = analyze(`${name}\t${formulaStr}`);
    if (!result) return { columns: [], error: "Empty formula" };
    return { columns: result.isRange ? result.columns : [result], isModifiedIdeal: result.isModifiedIdeal };
  } catch (e) {
    return { columns: [], error: e.message };
  }
}

function idealFacts(name, formulaStr) {
  const { columns, isModifiedIdeal, error } = analyzeAsWritten(name, formulaStr);
  return formulaFacts(formulaStr, columns, isModifiedIdeal, error);
}

// One citation's formula: the actual chemistry it reports, only converted
// into this app's _count_/^valence^ syntax. Unlike page 1's citation
// columns (buildEmpiricalRows), nothing is taken from the ideal formula — no
// H filled in, no valences bounded by it, no generic REE swapped for a named
// one. formulaStr is the converted formula; rawFormula is RRUFF's text as is.
function empiricalFacts(name, rawFormula) {
  // RRUFF writes the hydrate dot as "*"; the parser only knows "·" (same
  // swap as loadCitationsForMineral in cellparamsLoader.js).
  const dotted = rawFormula.replace(/\*/g, "·");
  const formulaStr = isFormulaFormatted(dotted) ? dotted : parseChemicalFormula(dotted);
  const { columns, isModifiedIdeal, error } = analyzeAsWritten(name, formulaStr);
  return { ...formulaFacts(formulaStr, columns, isModifiedIdeal, error), rawFormula };
}

// One entry per mineral on the IMA list (loadImaMineralList) that has a
// formula, with every cellparams record's empirical formula for it (matched
// by the shared mineral ID) as its citations. The formula checked is the
// list's valence formula — the one its Formula Weights button sends to this
// calculator. Entries without one (group names like "Amphibole", or
// "Amber") are left out.
export function groupMinerals(imaList, records) {
  const citationsById = new Map();
  for (const r of records) {
    if (!r.empiricalFormula) continue;
    if (!citationsById.has(r.mineralId)) citationsById.set(r.mineralId, []);
    citationsById.get(r.mineralId).push({ formula: r.empiricalFormula, reference: r.reference });
  }
  return imaList
    .filter((m) => m.valenceFormula)
    .map((m) => ({
      id: m.mineralId,
      name: m.mineralName,
      idealFormula: m.valenceFormula,
      citations: citationsById.get(m.mineralId) || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Facts for one mineral: { id, name, ideal, empirical: [...] }.
export function mineralFacts(mineral) {
  const ideal = idealFacts(mineral.name, mineral.idealFormula);
  const empirical = mineral.citations.map((c) => ({
    ...empiricalFacts(mineral.name, c.formula),
    reference: c.reference,
  }));
  return { id: mineral.id, name: mineral.name, ideal, empirical };
}

// Runs mineralFacts over every mineral a chunk at a time, yielding to the
// browser between chunks so the page can show progress instead of freezing.
export async function computeAllFacts(minerals, onProgress, chunkSize = 100) {
  const out = [];
  for (let i = 0; i < minerals.length; i += chunkSize) {
    for (const m of minerals.slice(i, i + chunkSize)) out.push(mineralFacts(m));
    onProgress?.(out.length, minerals.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return out;
}

const cantCalculate = (f) => f.reason === "unparseable";
const approximated = (f) => f.modifiedIdeal || f.reason === "unknownMultiplier";

// Everything the page counts, in the order it shows them. A metric with
// `section` starts a new section of the table. Each test runs on one
// formula's facts; `of` names the metric its count is a share of (all
// formulas if none); `sub` rows break down the row above them.
export const METRICS = [
  { section: "All formulas", id: "all", label: "All formulas", test: () => true },
  { id: "calculated", label: "Calculated", test: (f) => !cantCalculate(f), of: "all", hint: "The calculator gives a breakdown (possibly approximate, see below)" },

  { section: "What the calculator can't do yet", id: "cantCalculate", label: "Can't calculate", test: cantCalculate, of: "all", hint: "The formula doesn't parse, so there's no breakdown at all; the list shows the parser's message" },
  { id: "approximated", label: "Calculated only approximately", test: approximated, of: "all", hint: "A breakdown is shown, but not of the exact formula" },
  { id: "approx-modifiedIdeal", label: "More than one shared site, first element of each used", test: (f) => f.modifiedIdeal, of: "approximated", sub: true },
  { id: "approx-unknownMultiplier", label: "Unknown multiplier (n, x, y) taken as 1", test: (f) => f.reason === "unknownMultiplier", of: "approximated", sub: true },

  { section: "Questions", id: "imprecise", label: "Not precise", test: (f) => f.reason !== null, of: "all", hint: "Not one exact composition: a range, shared site, unknown multiplier, or doesn't parse" },
  ...Object.entries(IMPRECISE_REASONS).map(([reason, label]) => ({
    id: `imprecise-${reason}`,
    label,
    test: (f) => f.reason === reason,
    of: "imprecise",
    sub: true,
  })),
  { id: "divisor", label: "Common divisor in formula", test: (f) => f.divisor > 1, of: "wholeNumbers", hint: "Precise formulas whose whole-number amounts all divide by the same number, e.g. Ce2P10O30N4 → 2" },
  { id: "oxygenNotBalanced", label: "Has oxygen, doesn't charge balance", test: (f) => f.hasOxygen && f.balanced === false, of: "oxygen" },
  { id: "notBalanced", label: "Doesn't charge balance", test: (f) => f.balanced === false, of: "chargeChecked", hint: `Net charge more than ${BALANCE_TOLERANCE} from zero (for a range, at either end-member)` },

  { section: "Totals the questions are shares of", id: "precise", label: "Precise (one exact composition)", test: (f) => f.reason === null, of: "all" },
  { id: "wholeNumbers", label: "Precise, whole-number amounts", test: (f) => f.divisor != null, of: "precise" },
  { id: "chargeChecked", label: "Charge checked", test: (f) => f.balanced !== null, of: "all", hint: "Formulas that parse, other than native metals" },
  { id: "oxygen", label: "Charge checked, has oxygen", test: (f) => f.hasOxygen && f.balanced !== null, of: "chargeChecked" },
];
export const METRICS_BY_ID = new Map(METRICS.map((m) => [m.id, m]));
