import { analyze } from "./MineralFormulaParser.jsx";
import { parseChemicalFormula, isFormulaFormatted } from "./odrChemistryFormat.js";

// A citation is either a free-text reference ending in "(YYYY) pages" (the
// common journal-citation shape) or a bare RRUFF sample ID. An RRUFF ID is
// "Rxxyyyy" — the two-digit xx is the sample's 20xx submission year (e.g.
// "R250095" was submitted in 2025), yyyy is just that year's running
// sequence number and carries no date information of its own.
const RRUFF_ID_PATTERN = /^R(\d{2})\d{4}$/i;

// Returns null when neither shape matches, since there's nothing to safely
// guess at.
export function citationYear(citation) {
  const rruffMatch = RRUFF_ID_PATTERN.exec(citation.trim());
  if (rruffMatch) return 2000 + Number(rruffMatch[1]);
  const yearMatch = /\((\d{4})\)/.exec(citation);
  return yearMatch ? Number(yearMatch[1]) : null;
}

// The "(YYYY)" shown next to a citation in the UI, or null to show nothing.
// Suppressed for a bare RRUFF ID — that year is only the sample's submission
// year (decoded from the ID itself, see citationYear above), not a
// publication date, so appending it reads as a real citation year when it
// isn't one. Also suppressed when the citation text already spells the year
// out (the common journal-citation shape), so it isn't shown twice.
function displayYear(citation, year) {
  if (year == null) return null;
  const trimmed = citation.trim();
  if (RRUFF_ID_PATTERN.test(trimmed)) return null;
  if (trimmed.includes(`(${year})`)) return null;
  return year;
}

// Two analyze() results count as the same formula if they break down into
// the same set of elements at the same weight percent, each agreeing to 3
// decimal places — the same rounding the summary table itself displays.
// Comparing the resolved composition instead of the raw formula text is
// what lets differently-written formulas for the same substance register as
// the same underlying chemistry.
export function sameComposition(resultA, resultB) {
  if (resultA.atoms.length !== resultB.atoms.length) return false;
  return resultA.atoms.every((atomA) => {
    const atomB = resultB.atoms.find((a) => a.symbol === atomA.symbol);
    return atomB && atomA.percent.toFixed(3) === atomB.percent.toFixed(3);
  });
}

// Drops a citation row when an earlier-kept row already reports the same
// formula (by composition, see sameComposition) — regardless of unit cell,
// since two citations can refine the same substance to slightly different
// cell parameters and still be reporting the same underlying formula.
// Between duplicates, the older citation wins (citationYear); a row whose
// year can't be determined never displaces one that's already kept, since
// there's no basis to call it "older."
export function dedupeCitationRows(rows) {
  const kept = [];
  for (const row of rows) {
    const dupIndex = kept.findIndex((k) => sameComposition(k.result, row.result));
    if (dupIndex === -1) {
      kept.push(row);
      continue;
    }
    const existing = kept[dupIndex];
    if (row.year != null && (existing.year == null || row.year < existing.year)) {
      kept[dupIndex] = row;
    }
  }
  return kept;
}

// One row per citation's raw formula, converted (if it isn't already in
// this app's ^valence^/_count_ syntax) and analyzed exactly like a formula
// typed into the Custom Formula box. A citation whose formula fails to
// parse is dropped rather than breaking the whole comparison table — see
// mineralDataSources.js's row-level error handling for the same pattern at
// batch scale. Duplicate citations (same resolved formula — see
// dedupeCitationRows) are then collapsed down to the oldest one.
export function buildEmpiricalRows(name, citations) {
  const rows = [];
  for (const { formula, cell, citation } of citations) {
    const formulaStr = isFormulaFormatted(formula) ? formula : parseChemicalFormula(formula);
    try {
      const result = analyze(`${name}\t${formulaStr}`);
      const year = citationYear(citation);
      if (result) rows.push({ formulaStr, result, cell, citation, year, displayYear: displayYear(citation, year) });
    } catch (e) {
      // Skip a citation that doesn't parse — the rest of the table still
      // renders.
    }
  }
  return dedupeCitationRows(rows);
}

// Collapses the full ideal+empirical row list down to one column per unique
// composition (by sameComposition), keeping whichever row comes first —
// ideal rows lead the array (see buildIdealRows/LandingPage.jsx), so an
// empirical formula that matches the ideal one collapses onto the ideal
// column rather than the other way around. Used to power the "Show matching
// weights" checkbox: unchecked (the default) hides the redundant columns
// this produces so often, since a citation frequently just re-reports the
// mineral's own ideal formula.
export function collapseMatchingRows(rows) {
  const kept = [];
  for (const row of rows) {
    if (!kept.some((k) => sameComposition(k.result, row.result))) kept.push(row);
  }
  return kept;
}

// The mineral's own ideal formula, as 1-2 "(1)"/"(2)" columns (a plain
// formula is one column, a Type 1 range formula splits into its two
// end-members) — meant to lead the comparison table ahead of the citation
// columns buildEmpiricalRows produces. Empty if there's no ideal formula to
// show, or if it fails to parse — a bad ideal formula shouldn't block the
// citation comparison next to it.
export function buildIdealRows(name, formulaStr) {
  if (!name || !formulaStr) return [];
  let result;
  try {
    result = analyze(`${name}\t${formulaStr}`);
  } catch (e) {
    return [];
  }
  if (!result) return [];
  if (!result.isRange) return [{ formulaStr: result.formulaStr, result, isIdealRow: true }];
  return [
    { formulaStr: result.columns[0].formulaStr, result: { ...result.columns[0], isModifiedIdeal: result.isModifiedIdeal }, isIdealRow: true },
    { formulaStr: result.columns[1].formulaStr, result: { ...result.columns[1], isModifiedIdeal: result.isModifiedIdeal }, isIdealRow: true },
  ];
}
