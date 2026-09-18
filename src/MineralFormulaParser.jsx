import React, { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect, memo } from "react";
import { loadMineralsFromFile, loadMineralsFromApi } from "./mineralDataSources.js";
import { COLORS, tdStyle, renderFormula, backButtonStyle, displayFormulaStr } from "./shared.jsx";
import { SummaryView, SummaryDetail, FormulaHeader } from "./SummaryView.jsx";
import { formatDetailText, downloadTxt } from "./reportText.js";
import { parseChemicalFormula, isFormulaFormatted } from "./odrChemistryFormat.js";

// ---------------------------------------------------------------------------
// Element data: symbol -> { weight, valences: [default, ...alternates] }
// Transcribed from element_weights.txt. The first number after the weight is
// a count field from the source file; every number after that is a possible
// valence, with the first one used as the default when a formula doesn't
// specify one explicitly (e.g. "^2+^").
// ---------------------------------------------------------------------------
const ELEMENTS = {
  H: { weight: 1.00794, valences: [1] },
  D: { weight: 2.0135532, valences: [1] },
  He: { weight: 4.002602, valences: [0] },
  Li: { weight: 6.941, valences: [1] },
  Be: { weight: 9.012182, valences: [2] },
  B: { weight: 10.811, valences: [3] },
  C: { weight: 12.011, valences: [4] },
  N: { weight: 14.00674, valences: [-3, 5] },
  O: { weight: 15.9994, valences: [-2] },
  F: { weight: 18.9984032, valences: [-1] },
  Ne: { weight: 20.1797, valences: [0] },
  Na: { weight: 22.989768, valences: [1] },
  Mg: { weight: 24.305, valences: [2] },
  Al: { weight: 26.981539, valences: [3] },
  Si: { weight: 28.0855, valences: [4] },
  P: { weight: 30.973762, valences: [5] },
  S: { weight: 32.066, valences: [-2, 6] },
  Cl: { weight: 35.4527, valences: [-1, 7] },
  Ar: { weight: 39.948, valences: [0] },
  K: { weight: 39.0983, valences: [1] },
  Ca: { weight: 40.078, valences: [2] },
  Sc: { weight: 44.95591, valences: [3] },
  Ti: { weight: 47.88, valences: [4, 2, 3] },
  V: { weight: 50.9415, valences: [5, 4, 3, 2] },
  Cr: { weight: 51.9961, valences: [3, 6, 2] },
  Mn: { weight: 54.93805, valences: [2, 3] },
  Fe: { weight: 55.847, valences: [3, 2, 4] },
  Co: { weight: 58.9332, valences: [2, 3, 4] },
  Ni: { weight: 58.69, valences: [2, 3, 1, 4] },
  Cu: { weight: 63.546, valences: [1, 2] },
  Zn: { weight: 65.39, valences: [2] },
  Ga: { weight: 69.723, valences: [3] },
  Ge: { weight: 72.61, valences: [4] },
  As: { weight: 74.92159, valences: [-3, 5, 3, 2] },
  Se: { weight: 78.96, valences: [-2, 6] },
  Br: { weight: 79.904, valences: [-1] },
  Kr: { weight: 83.8, valences: [0] },
  Rb: { weight: 85.4678, valences: [1] },
  Sr: { weight: 87.62, valences: [2] },
  Y: { weight: 88.90585, valences: [3] },
  Zr: { weight: 91.224, valences: [4, 2, 3] },
  Nb: { weight: 92.90638, valences: [5, 4, 3, 2] },
  Mo: { weight: 95.94, valences: [6, 4, 5, 3, 2] },
  Tc: { weight: 98, valences: [6] },
  Ru: { weight: 101.07, valences: [2, 3, 4, 6, 7, 8] },
  Rh: { weight: 102.9055, valences: [3, 4, 2, 6] },
  Pd: { weight: 106.42, valences: [2, 4, 6] },
  Ag: { weight: 107.8682, valences: [1, 2, 3] },
  Cd: { weight: 112.411, valences: [2, 1] },
  In: { weight: 114.82, valences: [3, 2, 1] },
  Sn: { weight: 118.71, valences: [2, 4] },
  Sb: { weight: 121.75, valences: [3, 5, -3, 4] },
  Te: { weight: 127.6, valences: [-2, 4, 6, 2] },
  I: { weight: 126.90447, valences: [-1, 5, 7] },
  Xe: { weight: 131.29, valences: [0] },
  Cs: { weight: 132.90543, valences: [1] },
  Ba: { weight: 137.327, valences: [2] },
  La: { weight: 138.9055, valences: [3] },
  Ce: { weight: 140.115, valences: [3, 4] },
  REE: { weight: 140.115, valences: [3, 4] },
  Pr: { weight: 140.90765, valences: [3] },
  Nd: { weight: 144.24, valences: [3, 4] },
  Pm: { weight: 145, valences: [3] },
  Sm: { weight: 150.36, valences: [3, 2] },
  Eu: { weight: 151.965, valences: [2, 3] },
  Gd: { weight: 157.25, valences: [3] },
  Tb: { weight: 158.92534, valences: [3, 4] },
  Dy: { weight: 162.5, valences: [3] },
  Ho: { weight: 164.93032, valences: [3] },
  Er: { weight: 167.26, valences: [3] },
  Tm: { weight: 168.93421, valences: [2, 3] },
  Yb: { weight: 173.04, valences: [3, 2] },
  Lu: { weight: 174.967, valences: [3] },
  Hf: { weight: 178.49, valences: [4] },
  Ta: { weight: 180.9479, valences: [5, 4, 3] },
  W: { weight: 183.85, valences: [6, 4, 2, 3, 5] },
  Re: { weight: 186.207, valences: [-1, 1, 2, 3, 4, 5, 6, 7] },
  Os: { weight: 190.2, valences: [2, 3, 4, 6, 8] },
  Ir: { weight: 192.22, valences: [3, 4, 1, 2, 6] },
  Pt: { weight: 195.08, valences: [2, 4, 1, 3, 6] },
  Au: { weight: 196.96654, valences: [1, 2, 3] },
  Hg: { weight: 200.59, valences: [2, 1] },
  Tl: { weight: 204.3833, valences: [1, 2, 3] },
  Pb: { weight: 207.2, valences: [2, 4] },
  Bi: { weight: 208.98037, valences: [3, -3, 2, 4, 5] },
  Po: { weight: 209, valences: [-2, 2, 4, 6] },
  At: { weight: 210, valences: [-1] },
  Rn: { weight: 222, valences: [0] },
  Fr: { weight: 223, valences: [1] },
  Ra: { weight: 226, valences: [2] },
  Ac: { weight: 227, valences: [3] },
  Th: { weight: 232.0381, valences: [4] },
  Pa: { weight: 231.03588, valences: [5] },
  U: { weight: 238.02891, valences: [6, 2, 3, 4, 5] },
  Np: { weight: 237, valences: [0] },
  Pu: { weight: 244, valences: [0] },
  Am: { weight: 243, valences: [0] },
  Cm: { weight: 247, valences: [0] },
  Bk: { weight: 247, valences: [0] },
  Cf: { weight: 251, valences: [0] },
  Es: { weight: 252, valences: [0] },
  Fm: { weight: 257, valences: [0] },
  Md: { weight: 258, valences: [0] },
  No: { weight: 259, valences: [0] },
  Lr: { weight: 262, valences: [0] },
  Rf: { weight: 261, valences: [0] },
  Db: { weight: 262, valences: [0] },
  Sg: { weight: 266, valences: [0] },
  Bh: { weight: 264, valences: [0] },
  Hs: { weight: 269, valences: [0] },
  Mt: { weight: 268, valences: [0] },
  Ds: { weight: 281, valences: [0] },
  Rg: { weight: 272, valences: [0] },
  Bx: { weight: 0.0, valences: [0] },
};

// A subscript containing a letter is one of two very different things:
//   Type 1 — a clean numeric range, e.g. '_4.5-2.5_': the dash just
//     separates two plain numbers. The first becomes "column 1"'s count,
//     the second "column 2"'s (site-sharing between two end-member
//     compositions).
//   Type 2 — an algebraic expression in a single variable (almost always
//     'x', but sometimes 'y', 'z', 'n', etc. — the source data isn't
//     consistent), e.g. '_40-2x_' or '_x/2_'. The dash there is a minus
//     sign, not a range separator. This is only solvable because mineral
//     formulas conventionally state the variable's bound elsewhere in the
//     same string, e.g. '(0.2 ≤ x ≤ 0.5)' — see findVariableBounds below.
//     Resolving it turns the algebraic subscript into the same
//     { start, end, low, high } shape a Type 1 range produces, so every
//     column/mass/charge computation downstream doesn't need to know which
//     kind actually produced the range.
// A formula that depends on *more than one* distinct variable (e.g. both x
// and y, each with its own independent bound) is deliberately left
// unsupported: for a single variable, "column 1"/"column 2" just means
// "evaluate at each end of the stated interval," but with two independent
// variables there's no textual basis for knowing whether their extremes are
// meant to pair up (both low, both high) or vary independently — guessing
// would silently misrepresent the real end-member compositions, so this
// throws instead of picking an arbitrary pairing.
function isCleanRange(raw) {
  return /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(raw);
}

// Parses a fraction like '1/3' (seen in bound clauses such as 'x ≤ 1/3') as
// well as a plain number; NaN if `raw` is neither.
function parseNum(raw) {
  const s = raw.trim();
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
  return parseFloat(s);
}

// Decomposes an algebraic subscript's raw content into a sum of terms, each
// either a bare constant or a coefficient*variable[/divisor] — e.g.
// '18+x/2' -> [{value: 18}, {variable: 'x', value: 0.5}], read as
// 18 + 0.5*x. Returns null if `raw` doesn't cleanly decompose this way —
// e.g. stray text like 'max' (a transcription artifact seen in the source
// data) or a three-number typo like '0.4-0-8' — so the caller can hard-fail
// rather than silently guess at a malformed expression.
function parseLinearExpr(raw) {
  let s = raw.trim();
  if (s.length >= 2 && s[0] === "(" && s[s.length - 1] === ")") {
    s = s.slice(1, -1).trim();
  }
  const chunks = s.match(/[+-]?[^+-]+/g);
  if (!chunks) return null;
  const terms = [];
  for (const chunk of chunks) {
    const m = chunk.trim().match(/^([+-]?)\s*(\d+(?:\.\d+)?)?\s*([a-z])?(?:\s*\/\s*(\d+(?:\.\d+)?))?$/);
    if (!m || (m[2] === undefined && m[3] === undefined)) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const coeff = m[2] !== undefined ? parseFloat(m[2]) : 1;
    const divisor = m[4] !== undefined ? parseFloat(m[4]) : 1;
    terms.push({ variable: m[3] || null, value: (sign * coeff) / divisor });
  }
  return terms;
}

function evalLinearExpr(terms, value) {
  return terms.reduce((sum, t) => sum + (t.variable ? t.value * value : t.value), 0);
}

// Finds every '_..._' subscript in the formula whose content isn't a clean
// Type 1 range but does contain a lowercase letter — i.e. every candidate
// Type 2 algebraic subscript — gathered up front (before the real
// recursive-descent parse below) so all of them can be resolved against a
// single shared variable bound looked up once per formula.
function findAlgebraicSubscripts(str) {
  const found = [];
  const re = /_([^_]*)_/g;
  let m;
  while ((m = re.exec(str))) {
    const raw = m[1];
    if (raw && /[a-z]/.test(raw) && !isCleanRange(raw)) {
      found.push({ raw, index: m.index });
    }
  }
  return found;
}

// Scans the *whole* formula string — an algebraic subscript's variable
// bound is almost always stated elsewhere in that same string, e.g. a
// trailing '(0.2 ≤ x ≤ 0.5)' — for a bound on `varName`. Recognizes the
// handful of notations actually seen in the source data:
//   - a double inequality, '0.2 ≤ x ≤ 0.5' (mixing '≤'/'≈'/'~' freely,
//     since they're used interchangeably as bound markers in practice, e.g.
//     '0.2 ≈ x ≤ 0.5');
//   - an '=' range, 'x = 0.05-0.08';
//   - a one-sided upper bound, 'x ≤ 0.5' or 'x ≤ 1/3', whose missing lower
//     bound defaults to 0 — these are always non-negative
//     substitution/occupancy fractions in this domain;
//   - a single approximate/exact value, 'x ~ 0.5', 'x ≈ 0.4', 'x = 0.43'.
// A strict '<' or '>' is treated exactly the same as its closed-interval
// sibling ('≤'/'≥') — '<' resolves a bound the same way '≤' does, and '>'
// is left unresolved the same way '≥' already is (see the one-sided lower
// bound note below).
// Anything else — the variable mentioned with no parseable bound nearby, or
// one mangled by a transcription typo like '0.4-0-8' or '0 ≤ x << 2' — is
// reported as 'malformed' or 'not_found' rather than guessed at.
function findVariableBounds(str, varName) {
  const NUM = "\\d+(?:\\.\\d+)?(?:\\s*/\\s*\\d+(?:\\.\\d+)?)?";
  const DBL_OP = "([<≤≦≈~])";
  // A captured number must end cleanly here -- whitespace, a closing
  // bracket, a separator, or the end of the string -- not run straight into
  // more digits/a dash. Required as a *trailing* check on the overall match
  // rather than a lookahead glued to the number itself, because a greedy
  // number that fails a glued lookahead can just backtrack to a shorter
  // prefix that dodges it (e.g. the typo 'x = 0.4-0-8' backtracking '0.4'
  // down to '0' and silently "resolving" x=0 instead of being rejected).
  const TERM = "(?=[\\s\\),;\\]]|$)";

  let m = str.match(new RegExp(`(${NUM})\\s*${DBL_OP}\\s*\\b${varName}\\b\\s*${DBL_OP}\\s*(${NUM})${TERM}`));
  if (m) {
    return { kind: "range", low: parseNum(m[1]), high: parseNum(m[4]) };
  }

  m = str.match(new RegExp(`\\b${varName}\\b\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)${TERM}`));
  if (m) return { kind: "range", low: parseNum(m[1]), high: parseNum(m[2]) };

  m = str.match(new RegExp(`\\b${varName}\\b\\s*([<≤≦])\\s*(${NUM})${TERM}`));
  if (m) {
    return { kind: "range", low: 0, high: parseNum(m[2]) };
  }

  // A lower-only bound ('x > 0.5' / 'x ≥ 0.5') has no natural default upper
  // bound the way an upper-only bound's missing lower end defaults to 0 —
  // there's no sense in which an occupancy/substitution fraction in this
  // domain has an obvious ceiling, so it can't be resolved into a range
  // either way, whether written with '>' or '≥'. Left unmatched here so it
  // falls through to the generic 'malformed'/'not_found' handling below.

  m = str.match(new RegExp(`\\b${varName}\\b\\s*[~≈=]\\s*(${NUM})${TERM}`));
  if (m) return { kind: "point", value: parseNum(m[1]) };

  // Last resort: does `varName` show up anywhere outside a subscript at
  // all? Checked against the string with every '_..._' subscript blanked
  // out, so e.g. the 'x' in '_18+x/2_' — flanked by '+' and '/', so it
  // reads as a free-standing word — doesn't get mistaken for a bound note
  // that merely failed to parse; that formula truly has no bound stated.
  const outsideSubscripts = str.replace(/_[^_]*_/g, " ");
  if (new RegExp(`\\b${varName}\\b`).test(outsideSubscripts)) return { kind: "malformed" };
  return { kind: "not_found" };
}

// A count is either a plain number, or — for a Type 1 range subscript — a
// { low, high } pair. These two helpers let arithmetic (multiplying a group
// count into its sub-atoms, summing counts of merged atoms) work the same
// way regardless of which shape either side is.
// A single representative number for a count, whichever shape it's in —
// used only for weighting a group valence split across atoms (see the
// bracket branch of parseTerms), where exact low/high fidelity doesn't
// matter the way it does for the real mass/count math above.
function repCount(count) {
  return typeof count === "number" ? count : (count.low + count.high) / 2;
}

function mulCount(base, factor) {
  if (typeof base === "number" && typeof factor === "number") return base * factor;
  const bLow = typeof base === "number" ? base : base.low;
  const bHigh = typeof base === "number" ? base : base.high;
  const fLow = typeof factor === "number" ? factor : factor.low;
  const fHigh = typeof factor === "number" ? factor : factor.high;
  return { low: bLow * fLow, high: bHigh * fHigh };
}

function addCount(a, b) {
  if (typeof a === "number" && typeof b === "number") return a + b;
  const aLow = typeof a === "number" ? a : a.low;
  const aHigh = typeof a === "number" ? a : a.high;
  const bLow = typeof b === "number" ? b : b.low;
  const bHigh = typeof b === "number" ? b : b.high;
  return { low: aLow + bLow, high: aHigh + bHigh };
}

// Rare earth elements (plus the generic "Ln" placeholder for "lanthanide").
// A comma directly followed by the literal 'REE' — e.g. site-sharing like
// '(Y,REE)' — is the one comma pattern this parser understands: it means
// "this site is occupied by the named REE, or generically by rare earths at
// large." Only a member of this list is allowed to stand to the left of a
// ',REE'; anything else is treated the same as any other unsupported comma.
const REE_ELEMENTS = new Set([
  "Y", "La", "Ln", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd",
  "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu",
]);

// ---------------------------------------------------------------------------
// Recursive-descent parser.
//   Element  := [A-Z][a-z]*
//   Valence  := '^' digits [+-]? '^'      (optional, right after an element)
//   Count    := '_' number '_'            (optional, after an element or ')')
//                number may be a decimal (e.g. '_1.5_'); a Type 1 range like
//                '_0.5-2.5_' produces a { low, high } count (see
//                isCleanRange above); a Type 2 algebraic subscript like
//                '_40-2x_' or '_x/2_' is resolved against a variable bound
//                stated elsewhere in the formula and produces the same
//                shape (see findVariableBounds) — unless the formula
//                depends on more than one variable, which throws instead.
//   Group    := ('(' Term* ')' | '[' Term* ']' | '{' Term* '}') Valence? Count?
//                bracket types are interchangeable in meaning but a closing
//                bracket must match the type it opened with, e.g. '[' ... ')'
//                throws a mismatched-bracket error. A Valence directly after
//                the closing bracket (e.g. '(AsS)^3-^') states the charge of
//                the whole enclosed complex ion, not any one atom in it — it
//                is split across the group's atoms in proportion to their
//                own counts, so summing count*valence over the group still
//                totals exactly the stated group charge (see the bracket
//                branch of parseTerms below). This overrides whatever
//                valence — explicit or default — each atom would otherwise
//                have picked up on its own.
//   '·' is a hydrate/chain separator and is simply skipped.
//   A ',' anywhere in the formula throws, UNLESS it's immediately followed by
//   the literal 'REE' (e.g. '(Y,REE)') — that one case is resolved by
//   dropping the ',REE' and using whichever element sat to its left for the
//   actual weight/valence/count math. The displayed formula string is never
//   touched by this substitution, so the UI still shows 'Y,REE' as typed.
// ---------------------------------------------------------------------------
function parseFormula(str) {
  let i = 0;
  const n = str.length;
  // Every Type 1 range's exact position in `str`, so the caller can rebuild
  // a concrete formula string per end-member (see substituteRanges below).
  // A resolved Type 2 algebraic span (see readCount) is pushed in here too,
  // once evaluated down to concrete numbers — from this point on the two
  // types are indistinguishable to every downstream consumer.
  const rangeSpans = [];

  // Every algebraic (Type 2) subscript in a formula is resolved against the
  // same single variable, looked up once here — before the real parse below
  // — so readCount() can just evaluate each one directly instead of
  // threading bound-lookup state through the recursive descent.
  let resolvedVar = null;
  {
    const algebraicSubs = findAlgebraicSubscripts(str);
    if (algebraicSubs.length > 0) {
      const variables = new Set();
      for (const { raw, index } of algebraicSubs) {
        const terms = parseLinearExpr(raw);
        if (!terms) {
          throw new Error(
            `Malformed algebraic subscript '_${raw}_' at position ${index} — doesn't match a recognizable expression like '40-2x' or 'x/2'. Not supported.`
          );
        }
        for (const t of terms) if (t.variable) variables.add(t.variable);
      }
      if (variables.size > 1) {
        throw new Error(
          `Formula depends on multiple variables (${[...variables].sort().join(", ")}) — not supported yet.`
        );
      }
      const [varName] = variables;
      const bounds = findVariableBounds(str, varName);
      if (bounds.kind === "not_found") {
        throw new Error(
          `Formula depends on '${varName}', but no bounds for '${varName}' were found elsewhere in it (e.g. '(${varName} = 0.2-0.5)'). Not supported.`
        );
      }
      if (bounds.kind === "malformed") {
        throw new Error(
          `Found what looks like a bound on '${varName}' in the formula, but couldn't parse it into a clean range or value. Not supported.`
        );
      }
      resolvedVar = bounds;
    }
  }

  function readCount() {
    if (str[i] !== "_") return 1;
    const end = str.indexOf("_", i + 1);
    if (end === -1) throw new Error(`Unterminated '_' count at position ${i}`);
    const raw = str.slice(i + 1, end);
    const start = i + 1;

    if (isCleanRange(raw)) {
      const [lowStr, highStr] = raw.split("-");
      const low = parseFloat(lowStr);
      const high = parseFloat(highStr);
      rangeSpans.push({ start, end, low, high });
      i = end + 1;
      return { low, high };
    }

    if (/[a-z]/.test(raw)) {
      const terms = parseLinearExpr(raw);
      if (!terms) {
        throw new Error(
          `Malformed algebraic subscript '_${raw}_' at position ${i} — doesn't match a recognizable expression like '40-2x' or 'x/2'. Not supported.`
        );
      }
      i = end + 1;
      // A point-value bound (e.g. 'x ≈ 0.4') has no real low/high spread —
      // evaluating the expression at that same value for both ends still
      // reuses the exact Type 1 { low, high } span/substitution machinery
      // (rather than a second, formula-string-patching path of its own),
      // at the cost of the UI showing two identical columns instead of one.
      const low = evalLinearExpr(terms, resolvedVar.kind === "point" ? resolvedVar.value : resolvedVar.low);
      const high = evalLinearExpr(terms, resolvedVar.kind === "point" ? resolvedVar.value : resolvedVar.high);
      rangeSpans.push({ start, end, low, high });
      return { low, high };
    }

    if (raw.includes("-")) {
      throw new Error(
        `Range subscript '_${raw}_' at position ${i} is not supported yet.`
      );
    }
    // A plain fraction like '1/3' or '7/3' (no variable, no dash) — parseNum
    // resolves it to its decimal value; without this, parseFloat("1/3")
    // would silently read only the "1" and drop the "/3" entirely.
    const val = parseNum(raw);
    i = end + 1;
    return isNaN(val) ? 1 : val;
  }

  function readValence() {
    if (str[i] !== "^") return null;
    const start = i;
    const end = str.indexOf("^", i + 1);
    if (end === -1) throw new Error(`Unterminated '^' valence at position ${i}`);
    const raw = str.slice(i + 1, end);
    i = end + 1;
    const m = raw.match(/^(\d+)\s*([+-])$/);
    if (!m) {
      throw new Error(
        `Valence '^${raw}^' at position ${start} is missing its required trailing + or - sign (e.g. '^2+^' or '^3-^').`
      );
    }
    const num = parseInt(m[1], 10);
    return m[2] === "-" ? -num : num;
  }

  const BRACKET_PAIRS = { "(": ")", "[": "]", "{": "}" };
  const CLOSERS = new Set(Object.values(BRACKET_PAIRS));

  function parseTerms() {
    const atoms = [];
    while (i < n) {
      const c = str[i];
      if (CLOSERS.has(c)) break;

      if (BRACKET_PAIRS[c]) {
        const opener = c;
        const closer = BRACKET_PAIRS[c];
        const openPos = i;
        i++; // consume opening bracket
        const sub = parseTerms();
        if (str[i] === undefined) {
          throw new Error(`Expected '${closer}' to close '${opener}' opened at position ${openPos}, but reached end of formula`);
        }
        if (str[i] !== closer) {
          throw new Error(
            `Mismatched bracket: '${opener}' opened at position ${openPos} was closed with '${str[i]}' at position ${i} — expected '${closer}'`
          );
        }
        i++; // consume closing bracket
        const groupValence = readValence();
        const count = readCount();
        if (groupValence !== null) {
          const totalInner = sub.reduce((s, a) => s + repCount(a.count), 0);
          const perUnitValence = totalInner ? groupValence / totalInner : 0;
          for (const a of sub) {
            atoms.push({ ...a, explicitValence: perUnitValence, count: mulCount(a.count, count) });
          }
        } else {
          for (const a of sub) atoms.push({ ...a, count: mulCount(a.count, count) });
        }
        continue;
      }

      if (c === "\u00b7" || c === "." ) {
        // hydrate dot separator, e.g. ·3H2O — just move on
        i++;
        continue;
      }

      if (c === ",") {
        const isReeComma = str.slice(i + 1, i + 4) === "REE" && !/[a-z]/.test(str[i + 4] || "");
        if (isReeComma) {
          const leftAtom = atoms[atoms.length - 1];
          if (!leftAtom) {
            throw new Error(`',REE' at position ${i} has no element to its left to stand in for it.`);
          }
          if (!REE_ELEMENTS.has(leftAtom.symbol)) {
            throw new Error(
              `'${leftAtom.symbol},REE' at position ${i} — '${leftAtom.symbol}' isn't a recognized REE element, so it can't be combined with REE this way.`
            );
          }
          i += 4; // skip ',REE' — the element already pushed stands in for the site
          // A subscript right after 'REE' (e.g. 'La,REE_2_') describes the
          // combined La+REE site, not a separate REE atom — fold it into
          // the left element's count the same way a bracket's count folds
          // into the atoms it closes over.
          const reeCount = readCount();
          leftAtom.count = mulCount(leftAtom.count, reeCount);
          continue;
        }
        throw new Error(
          "Our automated routine does not know how to interpret this formula because of the commas."
        );
      }

      if (str.slice(i, i + 3).toLowerCase() === "box") {
        i += 3;
        const explicitValence = readValence();
        const count = readCount();
        atoms.push({ symbol: "Bx", count, explicitValence });
        continue;
      }

      // 'REE' standing alone (not the ',REE' site-sharing form handled
      // above) is a generic-rare-earth placeholder in its own right, e.g.
      // 'Na_0.5_REE_0.25_Ca_0.25_' — every letter is uppercase, so the
      // ordinary [A-Z][a-z]* symbol scan below would only ever grab the
      // leading 'R'. Recognized here the same way 'box' is, before that
      // generic scan gets a chance to misread it.
      if (str.slice(i, i + 3) === "REE" && !/[a-z]/.test(str[i + 3] || "")) {
        i += 3;
        const explicitValence = readValence();
        const count = readCount();
        atoms.push({ symbol: "REE", count, explicitValence });
        continue;
      }

      if (/[A-Z]/.test(c)) {
        let j = i + 1;
        while (j < n && /[a-z]/.test(str[j])) j++;
        const symbol = str.slice(i, j);
        i = j;
        const explicitValence = readValence();
        const count = readCount();
        atoms.push({ symbol, count, explicitValence });
        continue;
      }

      // digits that show up outside underscores (e.g. a leading hydrate
      // multiplier like "3H2O" or "2.5-3.0H2O") get folded into the next
      // element's count. Matched as a full number-or-range token up front
      // so a decimal point here isn't mistaken for the hydrate dot below,
      // and a dash here is treated as the same Type 1 range as '_a-b_'.
      if (/[0-9]/.test(c)) {
        const m = str.slice(i).match(/^(\d+(?:\.\d+)?)(-(\d+(?:\.\d+)?))?/);
        let mult;
        if (m[2]) {
          const low = parseFloat(m[1]);
          const high = parseFloat(m[3]);
          rangeSpans.push({ start: i, end: i + m[0].length, low, high });
          mult = { low, high };
        } else {
          mult = parseFloat(m[1]);
        }
        i += m[0].length;
        // peek the next element/group and multiply its resulting count
        const sub = parseTerms();
        for (const a of sub) atoms.push({ ...a, count: mulCount(a.count, mult) });
        continue;
      }

      // unknown / whitespace character — skip it
      i++;
    }
    return atoms;
  }

  const atoms = parseTerms();
  if (i < n && str[i] === ")") {
    throw new Error(`Unmatched ')' at position ${i}`);
  }
  return { atoms, rangeSpans };
}

// Rebuilds a concrete formula string for one end-member by replacing each
// Type 1 range span with just its low (or high) number, e.g. "Mg_4.5-2.5_"
// becomes "Mg_4.5_" for column 1 and "Mg_2.5_" for column 2. Spans are in
// left-to-right order since parseFormula only ever scans forward.
function substituteRanges(str, rangeSpans, which) {
  let out = "";
  let last = 0;
  for (const span of rangeSpans) {
    out += str.slice(last, span.start);
    out += String(span[which]);
    last = span.end;
  }
  out += str.slice(last);
  return out;
}

function resolveAtom(atom) {
  const data = ELEMENTS[atom.symbol];
  if (!data) {
    return {
      ...atom,
      weight: null,
      valence: atom.explicitValence,
      known: false,
    };
  }
  if (atom.explicitValence !== null && atom.explicitValence !== undefined) {
    return { ...atom, weight: data.weight, valence: atom.explicitValence, known: true };
  }
  // An element with more than one listed valence and no explicit marker
  // (e.g. bare "SO4" — sulfur is sulfide -2 or sulfate +6, and RRUFF's own
  // source formulas mark Fe/Al/As/U explicitly but never S) can't be pinned
  // to valences[0] as a fixed default without guessing wrong for a large
  // share of real minerals. Left unresolved here (via ambiguousValences)
  // for resolveAmbiguousValences to settle once the whole formula/fragment
  // is known — same net-charge reasoning tryChargeBalanceSplit already uses
  // for a comma-shared site.
  if (data.valences.length > 1) {
    return { ...atom, weight: data.weight, valence: undefined, ambiguousValences: data.valences, known: true };
  }
  return { ...atom, weight: data.weight, valence: data.valences[0], known: true };
}

// Picks a valence for every atom left ambiguous by resolveAtom — one choice
// per element symbol (all of that symbol's unspecified sites share it,
// matching how a single bare "SO4" is one physical assumption, not several)
// — by trying every combination of candidate valences across every
// ambiguous element at once and keeping whichever combination brings the
// atoms' total net charge closest to zero. A formula with no ambiguous
// atoms (the overwhelmingly common case: single-valence elements, or an
// explicit '^n+^' on everything that needs one) is returned unchanged.
// Ties keep the element's first-listed (most common) valence, so this never
// changes behavior for a formula that was already balanced under the old
// fixed-default rule.
function resolveAmbiguousValences(atoms) {
  const groups = [];
  const groupBySymbol = new Map();
  let fixedCharge = 0;
  for (const a of atoms) {
    if (!a.ambiguousValences) {
      fixedCharge += (a.valence || 0) * a.count;
      continue;
    }
    let g = groupBySymbol.get(a.symbol);
    if (!g) {
      g = { symbol: a.symbol, count: 0, candidates: a.ambiguousValences };
      groupBySymbol.set(a.symbol, g);
      groups.push(g);
    }
    g.count += a.count;
  }
  if (groups.length === 0) return atoms;

  let best = null;
  const combo = new Array(groups.length);
  (function search(idx, chargeSoFar) {
    if (idx === groups.length) {
      const diff = Math.abs(chargeSoFar);
      if (!best || diff < best.diff - 1e-9) best = { diff, choice: combo.slice() };
      return;
    }
    for (const v of groups[idx].candidates) {
      combo[idx] = v;
      search(idx + 1, chargeSoFar + v * groups[idx].count);
    }
  })(0, fixedCharge);

  const chosenBySymbol = new Map(groups.map((g, i) => [g.symbol, best.choice[i]]));
  return atoms.map((a) =>
    a.ambiguousValences
      ? { ...a, valence: chosenBySymbol.get(a.symbol), ambiguousValences: undefined }
      : a
  );
}

// Combines atoms that share both symbol and valence into a single entry
// with summed count, so e.g. two separately-parsed O^-2^ sites become one row.
function mergeAtoms(atoms) {
  const merged = [];
  const indexBySignature = new Map();
  for (const a of atoms) {
    const key = `${a.symbol} ${a.valence}`;
    const idx = indexBySignature.get(key);
    if (idx === undefined) {
      indexBySignature.set(key, merged.length);
      merged.push({ ...a });
    } else {
      merged[idx].count = addCount(merged[idx].count, a.count);
    }
  }
  return merged;
}

// True only when every recognized element present can *never* carry a
// negative valence per ELEMENTS' table — e.g. native metals like Cu or Au.
// Those aren't ionic compounds, so reporting a "net charge" or a per-atom
// valence for them is meaningless — this flag tells the views to hide both
// and show only atomic weight percents. A formula containing even one
// unrecognized element is treated conservatively (not metallic), since
// there's no data to rule out a negative valence for it.
function isMetallicFormula(atoms) {
  return atoms.every((a) => {
    const data = ELEMENTS[a.symbol];
    if (!data) return false;
    return !data.valences.some((v) => v < 0);
  });
}

function computeMassAndPct(rawAtoms) {
  const atoms = resolveAmbiguousValences(rawAtoms);
  const totalMass = atoms.reduce((s, a) => s + (a.weight || 0) * a.count, 0);
  const netCharge = atoms.reduce((s, a) => s + (a.valence || 0) * a.count, 0);
  const withPct = atoms.map((a) => ({
    ...a,
    totalMass: (a.weight || 0) * a.count,
    percent: totalMass ? ((a.weight || 0) * a.count * 100) / totalMass : 0,
  }));
  return { atoms: withPct, totalMass, netCharge, isMetallic: isMetallicFormula(atoms) };
}

// Finds every plain (non-REE) comma in the formula, together with its
// innermost enclosing bracket group — a '(...)'/'[...]'/'{...}' span, or the
// whole formula string if the comma isn't inside any bracket at all (the
// same "smallest enclosing group" search findVariableBounds's sibling used
// to use for its old two-way split). Commas are bucketed by that group's
// [start, end) span so a caller can tell whether every comma in the formula
// belongs to the very same group — e.g. all three commas in '(Fe,Mg,Ca)' —
// or whether they're spread across more than one, e.g. '(Fe,Mg)(Ca,Na)' or a
// bare comma sitting outside a bracketed group, which is what
// expandCommaGroup below refuses to guess at.
function commaGroups(str) {
  const OPENERS = new Set(["(", "[", "{"]);
  const CLOSERS = new Set([")", "]", "}"]);
  const groups = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== ",") continue;
    const isReeComma = str.slice(i + 1, i + 4) === "REE" && !/[a-z]/.test(str[i + 4] || "");
    if (isReeComma) continue; // handled separately, inline, by parseFormula

    const stack = [];
    for (let j = 0; j < i; j++) {
      if (OPENERS.has(str[j])) stack.push(j);
      else if (CLOSERS.has(str[j])) stack.pop();
    }
    const start = stack.length ? stack[stack.length - 1] + 1 : 0;

    let end = str.length;
    if (stack.length) {
      let depth = 1;
      for (let j = i + 1; j < str.length; j++) {
        if (OPENERS.has(str[j])) depth++;
        else if (CLOSERS.has(str[j])) {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
    }

    let group = groups.find((g) => g.start === start && g.end === end);
    if (!group) {
      group = { start, end, commaIdxs: [] };
      groups.push(group);
    }
    group.commaIdxs.push(i);
  }
  return groups;
}

// Matches one comma-separated token in a site-sharing group: a bare element
// symbol, optionally with its own explicit '^n+^' valence — e.g. 'Fe' or
// 'Fe^2+^'. Anything with more than one atom (like the 'OH' in '(O,OH)') has
// no single valence to compare against its neighbors, so it isn't matched
// here and expandCommaGroup reports it as unsupported instead of guessing.
const COMMA_TOKEN_RE = /^([A-Z][a-z]*)(?:\^(\d+)([+-])\^)?$/;

// A dash literally between two underscores in the batch search box, '_-_',
// is a dedicated token for "a numeric range subscript" — i.e. any '_..._'
// that has a '-' in it, like '_4.5-2.5_' or the '_0-0.5_' a comma
// site-sharing group expands to. '!_-_' excludes every formula with a range
// subscript; the bare '_-_' (no '!') keeps only rows that have one.
const RANGE_DASH_RE = /_[^_]*-[^_]*_/;

// Rewrites the one allowed comma-separated site-sharing group in a formula
// (see commaGroups above) into the equivalent '_low-high_' range subscripts
// the parser already understands for plain numeric ranges, so the rest of
// the pipeline — column splitting, formula-mass columns, the "(1)"/"(2)"
// UI — treats it exactly like any other Type 1 range instead of needing a
// parallel code path of its own. The leftmost element gets '_1-0.5_' (fully
// occupying the site in column 1, down to half in column 2); every other
// element splits the remaining half evenly across column 2, e.g. two other
// elements each get '_0-0.25_'. Returns the formula unchanged if it has no
// plain commas at all.
// Rounds away float noise (e.g. 7.600000000000001) and drops a trailing
// ".0" so the rewritten formula string reads the way a person would type it.
function formatSplitNum(n) {
  const rounded = Math.round(n * 1e9) / 1e9;
  return String(rounded);
}

// Sums valence*count over a plain (comma-free) formula fragment — used to
// find the net charge contributed by "everything outside the comma group",
// which is what pins down a heterovalent split (see tryChargeBalanceSplit).
// Range counts (Type 1/2) are collapsed to their representative value since
// exact low/high fidelity doesn't matter for this charge estimate.
function netChargeOfFragment(str) {
  const { atoms } = parseFormula(str);
  const resolved = resolveAmbiguousValences(
    atoms
      .map(resolveAtom)
      .filter((a) => a.symbol !== "Bx")
      .map((a) => ({ ...a, count: repCount(a.count) }))
  );
  return resolved.reduce((s, a) => s + (a.valence || 0) * a.count, 0);
}

// A site-sharing group (e.g. '(Si,Al)_8_') with a stated total site count
// has exactly one split that brings the whole formula's net charge to zero
// as soon as its occupants fall into two *different*, unambiguous valences
// — unlike a same-valence group (e.g. '(Fe,Mg)'), where any split leaves
// the charge unchanged and the generic 50% guess below is the best that can
// be done. Occupants are grouped into valence "classes" first — e.g. in
// '(Ca,Th^4+^,Ce^4+^)', Ca is its own 2+ class while Th and Ce share a 4+
// class — and the charge-balance equation is solved for each CLASS's total
// occupancy, not per occupant. With exactly two classes that pins down a
// unique split (e.g. Brockite's Ca_.5_Th^4+^_.25_Ce^4+^_.25_, from a 2+
// class of one and a 4+ class of two). A class with more than one member
// still isn't fully determined on its own — any blend of Th and Ce that
// sums to their class's share balances the same equation — so this divides
// a class's total evenly across its members rather than picking a favorite;
// every listed occupant stays in the result. Three or more distinct
// valences leaves even the per-class equation underdetermined, and this
// returns null rather than guess further.
// Returns { formulaStr, isModifiedIdeal } on success, or null if no
// physically-valid split is determinable — in which case the caller falls
// back to the generic range split.
function tryChargeBalanceSplit(formulaStr, group, parsedTokens) {
  const { start, end } = group;

  // The group must actually be bracketed (not a bare comma spanning the
  // whole formula). A count right after the closing bracket (e.g. the
  // '_8_' in '(Si,Al)_8_') pins the site's total occupancy; with none, the
  // site defaults to 1, same as any bracketed group or bare atom with no
  // subscript of its own.
  const openIdx = start - 1;
  if (openIdx < 0 || !"([{".includes(formulaStr[openIdx])) return null;
  const afterCloser = end + 1;
  const countMatch = formulaStr.slice(afterCloser).match(/^_(\d+(?:\.\d+)?)_/);
  const N = countMatch ? parseFloat(countMatch[1]) : 1;
  const afterGroup = countMatch ? afterCloser + countMatch[0].length : afterCloser;

  const rest = formulaStr.slice(0, openIdx) + formulaStr.slice(afterGroup);
  let restCharge;
  try {
    restCharge = netChargeOfFragment(rest);
  } catch {
    return null; // rest of the formula isn't parseable on its own; bail out
  }

  // Every occupant needs a single, pinned-down valence (an explicit
  // '^n+^', or an element with just one possible valence to begin with) to
  // be placed in a class — one that could still be more than one thing
  // (e.g. bare 'Fe') can't be assigned a share with any confidence, so the
  // whole split is left undetermined rather than guessed at.
  if (parsedTokens.some((t) => !t.valenceSet || t.valenceSet.length !== 1)) return null;

  // Group occupants by their pinned valence, in the order each valence
  // first appears in the list.
  const classes = [];
  for (const t of parsedTokens) {
    const v = t.valenceSet[0];
    let cls = classes.find((c) => c.valence === v);
    if (!cls) {
      cls = { valence: v, tokens: [] };
      classes.push(cls);
    }
    cls.tokens.push(t);
  }
  if (classes.length !== 2) return null; // only a two-class split is solvable from charge alone

  // Solve v0*a + v1*b = -restCharge, a + b = N, for the two classes' totals.
  const [c0, c1] = classes;
  const a = (-restCharge - c1.valence * N) / (c0.valence - c1.valence);
  const b = N - a;
  const EPS = 1e-9;
  if (!Number.isFinite(a) || a < -EPS || b < -EPS) return null;

  const clampedA = Math.min(Math.max(a, 0), N);
  const clampedB = N - clampedA;
  const shareOf = (total, cls) => total / cls.tokens.length;
  const shareA = shareOf(clampedA, c0);
  const shareB = shareOf(clampedB, c1);
  const replacement = parsedTokens
    .map((t) => `${t.raw}_${formatSplitNum(c0.tokens.includes(t) ? shareA : shareB)}_`)
    .join("");

  return {
    formulaStr: formulaStr.slice(0, openIdx) + replacement + formulaStr.slice(afterGroup),
    isModifiedIdeal: parsedTokens.length > 2,
  };
}

// Parses one comma-separated occupant. A bare element symbol (optionally
// with its own explicit valence, e.g. 'Fe' or 'Pb^2+^') is the common case.
// Anything else is tried as a self-contained multi-atom fragment instead —
// e.g. 'N^3-^H_4_' for ammonium, or 'OH' for hydroxide — using the same
// grammar the rest of the formula parses with, so a comma-shared site can
// list a complex ion as one of its candidates. isComplex marks that case,
// since it changes how the token can be substituted back into the formula
// (see collapseMultipleCommaGroupsToLeftmost).
function parseCommaToken(raw) {
  const m = raw.match(COMMA_TOKEN_RE);
  if (m) {
    const symbol = m[1];
    const explicitValence = m[2] ? (m[3] === "-" ? -parseInt(m[2], 10) : parseInt(m[2], 10)) : null;
    // The set used for tryChargeBalanceSplit's charge-balance solve, which
    // needs a single definite valence per token: just the explicit one if
    // it wrote one, otherwise every valence the element is known to take
    // (which only pins one down when the element has just a single
    // possibility to begin with, e.g. Al).
    const valenceSet =
      explicitValence !== null ? [explicitValence] : ELEMENTS[symbol] ? ELEMENTS[symbol].valences : null;
    // The set used for the "is this a plausible shared site" compatibility
    // check below: always every valence the element can take, even when
    // this token wrote an explicit one. An explicit '^3+^' on Fe pins down
    // what Fe actually is *if it's the one kept*, but a group like
    // '(Fe^3+^,Mg)' is still a real shared site — Fe can be 2+, matching
    // Mg — so narrowing to just the written valence here would reject
    // pairings the element could plausibly support.
    const fullValenceSet = ELEMENTS[symbol] ? ELEMENTS[symbol].valences : null;
    return { raw, symbol, valenceSet, fullValenceSet, isComplex: false };
  }

  // Not a bare element symbol — try it as a fragment on its own. Its
  // "valence" for the compatibility check is just its own net charge as a
  // complex ion (e.g. NH4 -> -3 + 4×1 = +1) — there's no list of alternate
  // possibilities the way a bare element has, just the one value its own
  // explicit valences (or defaults) resolve to.
  let netCharge;
  try {
    netCharge = netChargeOfFragment(raw);
  } catch {
    throw new Error(
      "Our automated routine does not know how to interpret this formula because of the commas."
    );
  }
  return { raw, symbol: raw, valenceSet: [netCharge], fullValenceSet: [netCharge], isComplex: true };
}

// Splits one comma group's raw inner text (e.g. 'Fe,Mg' from '(Fe,Mg)')
// into parsed tokens — shared by both the single-group range expansion
// below and the multi-group leftmost-pick collapse.
function parseCommaTokens(inner) {
  const tokens = inner.split(",");
  if (tokens.some((t) => !t)) {
    throw new Error(
      "Our automated routine does not know how to interpret this formula because of the commas."
    );
  }
  return tokens.map((raw) => parseCommaToken(raw));
}

// True when every occupant of a comma group is a bare element symbol
// (optionally with its own explicit valence) — the only shape the
// single-group numeric-range split can work with, since splitting appends a
// fresh trailing subscript directly onto each token; a multi-atom occupant
// already has its own subscript notation baked in.
function isSimpleCommaGroup(formulaStr, group) {
  const inner = formulaStr.slice(group.start, group.end);
  return inner.split(",").every((raw) => COMMA_TOKEN_RE.test(raw));
}

// True if every token in a comma group could plausibly carry the same
// valence (their fullValenceSets overlap) — the "shared site" requirement a
// comma group needs to be resolved without an arbitrary guess. A token with
// no known valence (an unrecognized element) doesn't rule anything out on
// its own, same as everywhere else in this file.
function commaGroupHasCommonValence(parsedTokens) {
  const knownSets = parsedTokens.map((t) => t.fullValenceSet).filter(Boolean);
  if (knownSets.length < 2) return true;
  const common = knownSets.reduce((acc, s) => acc.filter((v) => s.includes(v)));
  return common.length > 0;
}

// A comma-separated site collapses to one flat "modified ideal formula"
// rather than the numeric-range split a single simple group gets — either
// because there's more than one such site in the formula (e.g.
// '(Fe,Mg)(Ca,Na)', which has no telling how the two sites' occupancies
// should pair up), or because a site lists a multi-atom occupant (e.g.
// '(N^3-^H_4_,K,Na)', which can't be split by a trailing subscript the way
// a bare element can).
//
// Each group is resolved on its own merits, independent of how any other
// group in the formula turns out: a same-valence group (every occupant
// could plausibly carry the same charge) always collapses to its leftmost
// (first-listed, i.e. dominant) occupant, since picking among same-valence
// occupants never changes the formula's net charge no matter what else is
// going on elsewhere. A heterovalent group (like '(Ca,Ce^3+^,Sr,La)') can't
// be collapsed that way — but once every other group has been resolved to
// something concrete, it's in exactly the position a lone heterovalent
// group would be, so it gets the same charge-balance split (see
// tryChargeBalanceSplit) against the now-known rest-of-formula charge. That
// only pins down a unique answer when it's the one heterovalent group left;
// two or more at once leaves the balance equation underdetermined, and the
// whole formula is rejected rather than guessed at.
function collapseMultipleCommaGroupsToLeftmost(formulaStr, groups) {
  // Phase 1: collapse every same-valence group straight to its leftmost
  // occupant. Right-to-left so each earlier group's start/end offsets stay
  // valid as later (rightward) groups get replaced first; a heterovalent
  // group is left untouched (and its offsets stay valid too) for phase 2.
  const sorted = [...groups].sort((a, b) => b.start - a.start);
  let result = formulaStr;
  let anyHeterovalent = false;
  for (const { start, end } of sorted) {
    const inner = result.slice(start, end);
    const parsedTokens = parseCommaTokens(inner);
    if (!commaGroupHasCommonValence(parsedTokens)) {
      anyHeterovalent = true;
      continue;
    }
    const leftmost = parsedTokens[0];
    // A bare element's own trailing subscript is read directly after the
    // symbol, so the group's wrapping bracket can be dropped along with the
    // rest of the comma list — e.g. '(Fe,Mg)_2_' collapses to 'Fe_2_'
    // rather than leaving a redundant '(Fe)_2_' behind. A multi-atom
    // occupant already carries its own subscript notation, so the bracket
    // has to stay: it's what lets a trailing count right after the group
    // (the '_9_' in '(N^3-^H_4_,...)_9_') still apply to the whole kept
    // fragment instead of being silently dropped as stray text.
    const openIdx = start - 1;
    const hasBracket = openIdx >= 0 && "([{".includes(result[openIdx]);
    const stripBracket = hasBracket && !leftmost.isComplex;
    const spanStart = stripBracket ? openIdx : start;
    const spanEnd = stripBracket ? end + 1 : end;
    result = result.slice(0, spanStart) + leftmost.raw + result.slice(spanEnd);
  }
  if (!anyHeterovalent) return result;

  // Phase 2: re-locate whatever heterovalent group(s) are left in the now
  // partially-collapsed string (their offsets shifted as phase 1 replaced
  // text around them) and, if exactly one remains, try the same
  // charge-balance split a lone heterovalent group gets.
  const remaining = commaGroups(result);
  if (remaining.length === 1 && isSimpleCommaGroup(result, remaining[0])) {
    const parsedTokens = parseCommaTokens(result.slice(remaining[0].start, remaining[0].end));
    const balanced = tryChargeBalanceSplit(result, remaining[0], parsedTokens);
    if (balanced !== null) return balanced.formulaStr;
  }

  throw new Error(
    "Our automated routine does not know how to interpret this formula because of the commas."
  );
}

// Rewrites a formula's comma-separated site-sharing group(s) — see
// commaGroups above — into syntax the rest of the pipeline already
// understands, before the real parse starts. Returns { formulaStr,
// isModifiedIdeal }: isModifiedIdeal flags a result that came from the
// multi-group leftmost-pick collapse rather than the formula the user
// actually typed, so the UI can label it as such.
function expandCommaGroup(formulaStr) {
  const groups = commaGroups(formulaStr);
  if (groups.length === 0) return { formulaStr, isModifiedIdeal: false };
  // The numeric-range split below only works when there's exactly one
  // comma group and every occupant in it is a bare element symbol — see
  // isSimpleCommaGroup and collapseMultipleCommaGroupsToLeftmost.
  if (groups.length > 1 || !isSimpleCommaGroup(formulaStr, groups[0])) {
    return {
      formulaStr: collapseMultipleCommaGroupsToLeftmost(formulaStr, groups),
      isModifiedIdeal: true,
    };
  }

  const { start, end } = groups[0];
  const inner = formulaStr.slice(start, end);
  const parsedTokens = parseCommaTokens(inner);

  // A heterovalent site (different valences per element, like Si/Al) can
  // have a single charge-balanced split instead of an arbitrary range — try
  // that first, and only fall through to the generic split/validation below
  // if no unique valid solution exists.
  const balanced = tryChargeBalanceSplit(formulaStr, groups[0], parsedTokens);
  if (balanced !== null) return balanced;

  if (!commaGroupHasCommonValence(parsedTokens)) {
    throw new Error(
      "Our automated routine does not know how to interpret this formula because of the commas."
    );
  }

  const shareCount = parsedTokens.length - 1;
  const otherHigh = shareCount > 0 ? 0.5 / shareCount : 0;
  const expanded = parsedTokens
    .map((t, idx) => (idx === 0 ? `${t.raw}_1-0.5_` : `${t.raw}_0-${otherHigh}_`))
    .join("");
  return { formulaStr: formulaStr.slice(0, start) + expanded + formulaStr.slice(end), isModifiedIdeal: false };
}

// Parses and computes one concrete formula string — no name attached, no
// comma-splitting — either a plain result or, if it carries its own Type 1/2
// numeric range, the same two-column { low, high } shape analyze() has
// always returned for ranges.
function analyzeOne(formulaStr) {
  const { atoms: rawAtoms, rangeSpans } = parseFormula(formulaStr);
  // 'box'/Bx is a vacancy placeholder, not a real atom — it's allowed in the
  // typed formula so people can note a vacant site, but it has no mass and
  // shouldn't contribute to net charge or appear as a row in any view, so
  // it's dropped here before anything downstream (totals, Summary/Detail
  // views, exported text) ever sees it.
  const atoms = mergeAtoms(rawAtoms.map(resolveAtom)).filter((a) => a.symbol !== "Bx");

  // A resolved point-value variable (e.g. 'x=3') still produces a
  // { low, high } count shape — see readCount's point-value comment — but
  // with low === high there's no actual spread to show as two columns.
  const isRange = atoms.some((a) => typeof a.count === "object" && a.count.low !== a.count.high);
  if (!isRange) {
    const flatAtoms = atoms.map((a) => ({
      ...a,
      count: typeof a.count === "number" ? a.count : a.count.low,
    }));
    return { formulaStr, isRange: false, ...computeMassAndPct(flatAtoms) };
  }

  // Type 1 range subscript(s) present: compute the two end-member
  // compositions ("column 1" from each subscript's first number, "column 2"
  // from its second), sharing the same element/valence rows in the same
  // order, each paired with its own concrete (range-resolved) formula string.
  const columnOf = (which) => ({
    ...computeMassAndPct(
      atoms.map((a) => ({
        ...a,
        count: typeof a.count === "number" ? a.count : a.count[which],
      }))
    ),
    formulaStr: substituteRanges(formulaStr, rangeSpans, which),
  });

  return {
    formulaStr,
    isRange: true,
    columns: [columnOf("low"), columnOf("high")],
  };
}

export function analyze(rawInput) {
  // Allow "Name<TAB>Formula" pasted straight from the source list.
  const parts = rawInput.split("\t");
  const name = parts.length > 1 ? parts[0].trim() : "";
  let formulaStr = (parts.length > 1 ? parts[1] : parts[0]).trim();
  if (!formulaStr) return null;
  // Kept alongside the (possibly collapsed) formulaStr below so a modified
  // ideal formula's UI can still show the actual formula the user typed
  // next to the name, rather than the leftmost-element-per-group stand-in
  // used for the calculation.
  const originalFormulaStr = formulaStr;

  // A comma-separated site-sharing group (e.g. '(Fe,Mg)') is rewritten into
  // ordinary '_low-high_' range subscripts before the real parse — see
  // expandCommaGroup — so it flows through the same Type 1 range machinery
  // as any other range formula from here on. Left as the original text (and
  // whatever "not supported" error parseFormula's own comma handling throws
  // for the ',REE' case) if there's no plain comma to expand. More than one
  // comma group instead collapses to a single leftmost-element-per-group
  // "modified ideal formula" — isModifiedIdeal flags that for the UI.
  const { formulaStr: expandedFormulaStr, isModifiedIdeal } = expandCommaGroup(formulaStr);

  return { name, isModifiedIdeal, originalFormulaStr, ...analyzeOne(expandedFormulaStr) };
}

// Picks out a single end-member column from a ranged analyze() result and
// reshapes it into a plain (non-range) result, so DetailedView renders just
// that one column instead of both — used once a specific "(1)"/"(2)" has
// been picked out of the summary rather than showing the whole range.
export function pickColumn(result, idx) {
  if (!result.isRange) return result;
  const col = result.columns[idx];
  return {
    name: result.name,
    isModifiedIdeal: result.isModifiedIdeal,
    originalFormulaStr: result.originalFormulaStr,
    formulaStr: col.formulaStr,
    isRange: false,
    atoms: col.atoms,
    totalMass: col.totalMass,
    netCharge: col.netCharge,
    isMetallic: col.isMetallic,
  };
}

// Finds where each unknown element symbol sits in the raw formula text, so
// the editor can highlight just that text instead of the whole box. Walks
// the string with the same element-symbol tokenizing rules parseTerms uses
// (skipping 'box' and standalone 'REE' the same way) rather than reusing
// positions from the real parse, since expandCommaGroup can rewrite the
// string it hands to parseFormula — a comma-expanded position wouldn't line
// up with what the user actually typed in the box. Whether a symbol is
// "unknown" only depends on the symbol text itself (is it in ELEMENTS,
// modulo the 'box'/'REE' special cases), not where it appears, so scanning
// the original text separately and matching by symbol name is safe.
function findUnknownElementSpans(text, unknownSymbols) {
  if (!unknownSymbols || unknownSymbols.size === 0) return [];
  const spans = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    if (text.slice(i, i + 3).toLowerCase() === "box") {
      i += 3;
      continue;
    }
    if (text.slice(i, i + 3) === "REE" && !/[a-z]/.test(text[i + 3] || "")) {
      i += 3;
      continue;
    }
    if (/[A-Z]/.test(text[i])) {
      let j = i + 1;
      while (j < n && /[a-z]/.test(text[j])) j++;
      const symbol = text.slice(i, j);
      if (unknownSymbols.has(symbol)) spans.push({ start: i, end: j });
      i = j;
      continue;
    }
    i++;
  }
  return spans;
}

// Splits formula text into plain-text / highlighted-span pieces for the
// overlay backdrop, given the spans findUnknownElementSpans found.
function renderWithHighlights(text, spans) {
  if (spans.length === 0) return text;
  const nodes = [];
  let last = 0;
  spans.forEach((s, idx) => {
    if (s.start > last) nodes.push(text.slice(last, s.start));
    nodes.push(
      <mark
        key={idx}
        style={{
          background: "#fbeee5",
          color: COLORS.warn,
          borderRadius: 3,
        }}
      >
        {text.slice(s.start, s.end)}
      </mark>
    );
    last = s.end;
  });
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
export const EXAMPLES = [
  "Abellaite\tNaPb^2+^_2_(CO_3_)_2_(OH)",
  "Abenakiite-(Ce)\tNa_26_Ce^3+^_6_(SiO_3_)_6_(PO_4_)_6_(CO_3_)_6_(S^4+^O_2_)O",
  "Abernathyite\tK(U^6+^O_2_)As^5+^O_4_·3H_2_O",
  "Abhurite\tSn^2+^_21_O_6_(OH)_14_Cl_16_",
];

// The API loader is wired up and ready (see mineralDataSources.js), but
// there's no live database to point it at yet — flip this on once there is.
const SHOW_API_LOADER = false;

export default function MineralFormulaParser({ initialName, initialFormula, onBack } = {}) {
  const [nameInput, setNameInput] = useState(() => {
    if (initialName) return initialName;
    const params = new URLSearchParams(window.location.search);
    return params.get("mineral") || EXAMPLES[0].split("\t")[0];
  });
  const [formulaInput, setFormulaInput] = useState(() => {
    if (initialFormula) return initialFormula;
    const params = new URLSearchParams(window.location.search);
    return params.get("formula") || EXAMPLES[0].split("\t")[1];
  });
  const input = `${nameInput}\t${formulaInput}`;
  const [error, setError] = useState(null);
  const [batchRows, setBatchRows] = useState(null); // [{name, formulaStr}] from the active data source
  const [batchFileName, setBatchFileName] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  // Which rows the batch list shows alongside the text search: every row,
  // only the ones that parsed cleanly, or only the ones that errored.
  const [batchErrorFilter, setBatchErrorFilter] = useState("all"); // "all" | "no-errors" | "only-errors"
  // Which batch rows are checked for the "print selected" export, keyed by
  // each row's stable index into batchResults (not its position in the
  // currently-filtered/search view, which shifts as the user types).
  const [selectedBatchIds, setSelectedBatchIds] = useState(() => new Set());
  // Bumped on reset to force the (uncontrolled) file input to remount, so
  // its internal value clears too — otherwise re-selecting the same file
  // wouldn't fire onChange a second time.
  const [fileInputKey, setFileInputKey] = useState(0);
  const [apiUrl, setApiUrl] = useState("");
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  // Which summary column ("(1)"/"(2)") — if any — has been opened into its
  // full detail, for the single-formula box's result (shared by both the
  // typed formula and any mineral picked from the batch list below).
  const [topOpenColumnIndex, setTopOpenColumnIndex] = useState(null);

  const result = useMemo(() => {
    try {
      setError(null);
      return analyze(input);
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [input]);

  // Every unrecognized element symbol the parsed formula contains. Only
  // used to highlight those symbols in the formula textarea once the user
  // clicks away from it (see formulaFocused below) — highlighting on every
  // keystroke would flash the error color while a valid symbol is still
  // half-typed.
  const unknownSymbols = useMemo(() => {
    const set = new Set();
    if (!result) return set;
    const atomLists = result.isRange
      ? [result.columns[0].atoms, result.columns[1].atoms]
      : [result.atoms];
    atomLists.forEach((atoms) => atoms.forEach((a) => { if (a.known === false) set.add(a.symbol); }));
    return set;
  }, [result]);
  const [formulaFocused, setFormulaFocused] = useState(false);
  const formulaHighlightSpans = useMemo(
    () => (formulaFocused ? [] : findUnknownElementSpans(formulaInput, unknownSymbols)),
    [formulaInput, unknownSymbols, formulaFocused]
  );
  const formulaBackdropRef = useRef(null);

  // Lets users paste a "plain" formula (e.g. "Ni2+C31H32N4", copied straight
  // out of a paper) and have it converted into this app's "_2_" / "^2+^"
  // syntax instead of typing the delimiters by hand. Ported from ODR's own
  // chemistry-formatting plugin — see odrChemistryFormat.js. Refuses to run
  // on a formula that already looks formatted, since the converter assumes
  // plain input and mangles anything that already has delimiters in it.
  const [plainFormulaNotice, setPlainFormulaNotice] = useState(null);
  const convertPlainFormula = useCallback(() => {
    if (!formulaInput.trim()) return;
    if (isFormulaFormatted(formulaInput)) {
      setPlainFormulaNotice("Formula already looks formatted — nothing to convert.");
      return;
    }
    setFormulaInput(parseChemicalFormula(formulaInput));
    setPlainFormulaNotice(null);
  }, [formulaInput]);

  // A fresh formula should land back on the summary, not stay drilled into
  // whichever column the previous one had open.
  useEffect(() => {
    setTopOpenColumnIndex(null);
  }, [input]);

  const topSummaryRows = useMemo(() => {
    if (!result) return null;
    if (!result.isRange) return [{ formulaStr: result.formulaStr, result, isIdealRow: true }];
    // A range column's own result doesn't carry isModifiedIdeal (that flag
    // lives on the outer analyze() result) — copy it down so each row can
    // still show the "modified ideal formula" label regardless of range.
    return [
      { formulaStr: result.columns[0].formulaStr, result: { ...result.columns[0], isModifiedIdeal: result.isModifiedIdeal }, isIdealRow: true },
      { formulaStr: result.columns[1].formulaStr, result: { ...result.columns[1], isModifiedIdeal: result.isModifiedIdeal }, isIdealRow: true },
    ];
  }, [result]);

  const batchResults = useMemo(() => {
    if (!batchRows) return null;
    return batchRows.map((row, id) => {
      // Lowercased once here rather than on every keystroke's filter pass —
      // with a several-thousand-row list, redoing toLowerCase() on every
      // row for every character typed was the main source of filter lag.
      const searchText = `${row.name} ${row.formulaStr}`.toLowerCase();
      try {
        return {
          id,
          name: row.name,
          formulaStr: row.formulaStr,
          result: analyze(`${row.name}\t${row.formulaStr}`),
          error: null,
          searchText,
        };
      } catch (e) {
        return { id, name: row.name, formulaStr: row.formulaStr, result: null, error: e.message, searchText };
      }
    });
  }, [batchRows]);

  // Debounced so filtering (and the BatchTable re-render it triggers) runs
  // once shortly after typing pauses, instead of on every keystroke.
  const [debouncedBatchSearch, setDebouncedBatchSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBatchSearch(batchSearch), 150);
    return () => clearTimeout(t);
  }, [batchSearch]);

  // Any '!term' token (there can be several, e.g. "!box !REE") is pulled out
  // as something the row must NOT contain; whatever's left of the query,
  // once those are stripped out, is matched as the ordinary "must contain"
  // substring — so "iron !oxide !hydrate" means "contains iron, but neither
  // oxide nor hydrate".
  const filteredBatchResults = useMemo(() => {
    if (!batchResults) return null;
    let excludeRangeDash = false;
    let includeRangeDash = false;
    const withoutRangeDashToken = debouncedBatchSearch.replace(/(!)?_-_/g, (_, bang) => {
      if (bang) excludeRangeDash = true;
      else includeRangeDash = true;
      return " ";
    });
    const excludeTerms = [];
    const positive = withoutRangeDashToken
      .replace(/!(\S+)/g, (_, term) => {
        excludeTerms.push(term.toLowerCase());
        return " ";
      })
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    return batchResults.filter((r) => {
      if (batchErrorFilter === "no-errors" && r.error) return false;
      if (batchErrorFilter === "only-errors" && !r.error) return false;
      if (positive && !r.searchText.includes(positive)) return false;
      if (excludeTerms.some((t) => r.searchText.includes(t))) return false;
      if (excludeRangeDash && RANGE_DASH_RE.test(r.formulaStr)) return false;
      if (includeRangeDash && !RANGE_DASH_RE.test(r.formulaStr)) return false;
      return true;
    });
  }, [batchResults, debouncedBatchSearch, batchErrorFilter]);

  const errorRows = useMemo(() => {
    if (!batchResults) return null;
    return batchResults.filter((r) => r.error);
  }, [batchResults]);

  // Clicking a mineral in the batch list loads it into the single-formula
  // box above, so its summary/detail is handled by the one shared view at
  // the bottom of the page rather than a separate copy inside the list.
  const handleRowClick = useCallback((r) => {
    if (r.error) return;
    setNameInput(r.name);
    setFormulaInput(r.formulaStr);
  }, []);

  function handleBatchSearchChange(e) {
    setBatchSearch(e.target.value);
  }

  async function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBatchFileName(file.name);
    setApiError(null);
    const parsed = await loadMineralsFromFile(file);
    setBatchRows(parsed);
    setSelectedBatchIds(new Set());
  }

  // Clears the uploaded batch entirely, back to the empty "no file uploaded"
  // state — including the search/filter and selection tied to it, and the
  // file input itself (via fileInputKey) so the same file can be re-uploaded.
  function handleResetUpload() {
    setBatchRows(null);
    setBatchFileName("");
    setBatchSearch("");
    setBatchErrorFilter("all");
    setSelectedBatchIds(new Set());
    setFileInputKey((k) => k + 1);
  }

  // Loads the mineral list from a database/REST API instead of a file.
  // Points at whatever JSON endpoint the user has available today; once a
  // real database is online, this is the only call that needs to change.
  async function handleApiLoad() {
    if (!apiUrl.trim()) return;
    setApiLoading(true);
    setApiError(null);
    try {
      const parsed = await loadMineralsFromApi(apiUrl.trim());
      setBatchFileName(apiUrl.trim());
      setBatchRows(parsed);
      setSelectedBatchIds(new Set());
    } catch (e) {
      setApiError(e.message);
    } finally {
      setApiLoading(false);
    }
  }

  const handleToggleSelect = useCallback((id) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Selects/deselects every row currently visible under the search filter
  // (not the whole, possibly several-thousand-row, unfiltered list).
  const handleToggleSelectAllVisible = useCallback((rows) => {
    setSelectedBatchIds((prev) => {
      const allVisibleSelected = rows.length > 0 && rows.every((r) => prev.has(r.id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const r of rows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of rows) next.add(r.id);
      return next;
    });
  }, []);

  return (
    <div
      style={{
        minHeight: "100%",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Formula Weights
          </h1>
          {onBack && (
            <button onClick={onBack} style={{ ...backButtonStyle, flexShrink: 0 }}>
              ← Back
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          <label style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 600 }}>Name</label>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            spellCheck={false}
            placeholder="Mineral name…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: COLORS.text,
              fontFamily: COLORS.mono,
              fontSize: 14.5,
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <label style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 600 }}>
              Formatted formula: with subscripts inside of pairs of underscores, eg _2_, and superscripts inside of a pair of carets, eg ^2+^
            </label>
            <button
              type="button"
              onClick={convertPlainFormula}
              title="Converts a plain formula (e.g. Ni2+C31H32N4) into this app's _subscript_ / ^superscript^ syntax"
              style={{ ...backButtonStyle, flexShrink: 0, padding: "4px 10px", fontSize: 11.5 }}
            >
              Convert plain formula
            </button>
          </div>
          {plainFormulaNotice && (
            <div style={{ color: COLORS.warn, fontSize: 11.5 }}>{plainFormulaNotice}</div>
          )}
          <div style={{ position: "relative" }}>
            {/* Visible backdrop: renders the same text as the textarea below
                it, with any unknown element symbols marked. Perfectly
                overlaid so it reads as highlighting inside the box, since a
                plain <textarea> can't style individual characters itself. */}
            <div
              ref={formulaBackdropRef}
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                boxSizing: "border-box",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                background: COLORS.panel,
                padding: "12px 14px",
                color: COLORS.text,
                fontFamily: COLORS.mono,
                fontSize: 14.5,
                lineHeight: 1.4,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              {renderWithHighlights(formulaInput, formulaHighlightSpans)}
            </div>
            <textarea
              value={formulaInput}
              onChange={(e) => {
                setFormulaInput(e.target.value);
                setPlainFormulaNotice(null);
              }}
              onFocus={() => setFormulaFocused(true)}
              onBlur={() => setFormulaFocused(false)}
              onScroll={(e) => {
                if (formulaBackdropRef.current) {
                  formulaBackdropRef.current.scrollTop = e.target.scrollTop;
                  formulaBackdropRef.current.scrollLeft = e.target.scrollLeft;
                }
              }}
              rows={2}
              spellCheck={false}
              placeholder="Pb^2+^_2_(CO_3_)_2_(OH)"
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                boxSizing: "border-box",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: 8,
                padding: "12px 14px",
                color: "transparent",
                caretColor: COLORS.text,
                fontFamily: COLORS.mono,
                fontSize: 14.5,
                lineHeight: 1.4,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 18 }}>
            <FormulaHeader title={nameInput} formulaStr={formulaInput} />
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "#fbeee5",
                border: `1px solid ${COLORS.warn}`,
                color: COLORS.warn,
                fontSize: 13.5,
                fontFamily: COLORS.mono,
              }}
            >
              {error}
            </div>
          </div>
        )}

        {result && !error && (
          topOpenColumnIndex !== null ? (
            <SummaryDetail
              result={pickColumn(result, topOpenColumnIndex)}
              onBack={() => setTopOpenColumnIndex(null)}
            />
          ) : (
            <SummaryView
              title={result.name}
              formulaStr={displayFormulaStr(result)}
              rows={topSummaryRows}
              onSelect={setTopOpenColumnIndex}
            />
          )
        )}
      </div>

      {/* The batch list gets its own, wider container than the rest of the
          page — its rows carry much longer formula text than the single
          name/formula inputs above ever need to, so it benefits from more
          horizontal room than the 780px the rest of the page is capped at. */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            marginTop: 40,
            padding: "14px 16px",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.panel,
          }}
        >
          <p style={{ color: COLORS.textDim, fontSize: 13, margin: "0 0 10px" }}>
            Upload an excel or CSV file with a list of minerals{" "}
            <span style={{ color: COLORS.warn }}>AND THEIR CHEMICAL FORMULAS IN THE FORMAT ABOVE</span> to check them all at once.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label
              style={{
                background: COLORS.panelAlt,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Upload .xlsx / .csv
              <input
                key={fileInputKey}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            {batchFileName && (
              <span style={{ color: COLORS.textDim, fontSize: 12.5, fontFamily: COLORS.mono }}>
                {batchFileName} · {batchRows ? batchRows.length : 0} minerals
                {errorRows && errorRows.length > 0 && (
                  <span style={{ color: COLORS.warn }}> · {errorRows.length} errors</span>
                )}
              </span>
            )}
            {batchFileName && (
              <button
                onClick={handleResetUpload}
                title="Remove the uploaded file and start over"
                style={{
                  background: "#fbeee5",
                  border: `1px solid ${COLORS.warn}`,
                  color: COLORS.warn,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Clear file
              </button>
            )}
            {batchRows && batchRows.length > 0 && (
              <button
                onClick={() =>
                  printSelectedTxt(
                    batchResults.filter((r) => selectedBatchIds.has(r.id)),
                    "mineral-details.txt"
                  )
                }
                disabled={selectedBatchIds.size === 0}
                style={{
                  background: COLORS.panelAlt,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: selectedBatchIds.size === 0 ? "default" : "pointer",
                  opacity: selectedBatchIds.size === 0 ? 0.6 : 1,
                }}
              >
                Print List Report (.txt){selectedBatchIds.size > 0 ? ` (${selectedBatchIds.size})` : ""}
              </button>
            )}
            {batchRows && batchRows.length > 0 && (
              // Same selection as "Print selected", but skips the computed
              // breakdown entirely — just "Name Formula" one per line.
              <button
                onClick={() =>
                  printNoSolutionsTxt(
                    batchResults.filter((r) => selectedBatchIds.has(r.id)),
                    "mineral-list.txt"
                  )
                }
                disabled={selectedBatchIds.size === 0}
                title="Print just the selected rows' name and valence formula, with no computed breakdown"
                style={{
                  background: COLORS.panelAlt,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: selectedBatchIds.size === 0 ? "default" : "pointer",
                  opacity: selectedBatchIds.size === 0 ? 0.6 : 1,
                }}
              >
                Print formulas (.txt){selectedBatchIds.size > 0 ? ` (${selectedBatchIds.size})` : ""}
              </button>
            )}
            {batchRows && batchRows.length > 0 && (
              // Clears the whole selection at once (not just visible rows) —
              // styled in the same warn color as error states so it reads as
              // a step-back action, distinct from the neutral buttons beside
              // it, since undoing an accidental click means re-checking every
              // row by hand.
              <button
                onClick={() => setSelectedBatchIds(new Set())}
                disabled={selectedBatchIds.size === 0}
                title="Clear the entire selection, including rows not currently visible"
                style={{
                  background: "#fbeee5",
                  border: `1px solid ${COLORS.warn}`,
                  color: COLORS.warn,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: selectedBatchIds.size === 0 ? "default" : "pointer",
                  opacity: selectedBatchIds.size === 0 ? 0.5 : 1,
                }}
              >
                Deselect all
              </button>
            )}
            {batchRows && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={batchErrorFilter}
                  onChange={(e) => setBatchErrorFilter(e.target.value)}
                  style={{
                    background: COLORS.panelAlt,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: "7px 10px",
                    color: COLORS.text,
                    fontSize: 13,
                    fontFamily: COLORS.mono,
                    outline: "none",
                  }}
                >
                  <option value="all">All rows</option>
                  <option value="no-errors">No errors</option>
                  <option value="only-errors">Only errors</option>
                </select>
                <input
                  value={batchSearch}
                  onChange={handleBatchSearchChange}
                  placeholder="Filter by name or formula… (!term to exclude)"
                  title="Type '!term' to exclude rows containing it — e.g. '!box !REE' excludes both. '!_-_' excludes any range subscript like '_4.5-2.5_'; bare '_-_' keeps only rows that have one."
                  style={{
                    background: COLORS.panelAlt,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: "7px 12px",
                    color: COLORS.text,
                    fontSize: 13,
                    fontFamily: COLORS.mono,
                    outline: "none",
                    minWidth: 220,
                  }}
                />
              </div>
            )}
          </div>

          {SHOW_API_LOADER && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="Or load from a database API URL…"
              style={{
                flex: "1 1 260px",
                background: COLORS.panelAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                color: COLORS.text,
                fontSize: 13,
                fontFamily: COLORS.mono,
                outline: "none",
              }}
            />
            <button
              onClick={handleApiLoad}
              disabled={apiLoading || !apiUrl.trim()}
              style={{
                background: COLORS.panelAlt,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                cursor: apiLoading || !apiUrl.trim() ? "default" : "pointer",
                opacity: apiLoading || !apiUrl.trim() ? 0.6 : 1,
              }}
            >
              {apiLoading ? "Loading…" : "Load from API"}
            </button>
          </div>
          )}
          {SHOW_API_LOADER && apiError && (
            <div style={{ marginTop: 8, color: COLORS.warn, fontSize: 12.5, fontFamily: COLORS.mono }}>
              {apiError}
            </div>
          )}

          {filteredBatchResults && (
            <BatchTable
              rows={filteredBatchResults}
              onRowClick={handleRowClick}
              selectedIds={selectedBatchIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAllVisible}
            />
          )}

          {errorRows && errorRows.length > 0 && (
            <ErrorsPanel rows={errorRows} onDownload={downloadErrorsTxt} />
          )}
        </div>
      </div>
    </div>
  );
}

// A batch row that's a Type 1/2 range (or the new comma site-sharing split)
// has no single detail view of its own — print both end-member columns,
// each flattened into the same shape formatDetailText expects via
// pickColumn, the same way SummaryView's "(1)"/"(2)" drill-down does.
function formatMineralDetailText(r) {
  if (r.error || !r.result) {
    return `${r.name}\t${r.formulaStr}\n(Could not be parsed: ${r.error || "unknown error"})`;
  }
  if (r.result.isRange) {
    return [
      `(1) ${formatDetailText(pickColumn(r.result, 0))}`,
      "",
      `(2) ${formatDetailText(pickColumn(r.result, 1))}`,
    ].join("\n");
  }
  return formatDetailText(r.result);
}

function printSelectedTxt(rows, filename) {
  const content = rows.map(formatMineralDetailText).join("\n\n" + "=".repeat(60) + "\n\n");
  downloadTxt(content, filename);
}

// No computed breakdown, no mass/charge — just "Name Formula" one per line,
// for when all that's wanted is the plain list back out (e.g. to hand off,
// or to diff against another source) rather than the full parsed detail.
function printNoSolutionsTxt(rows, filename) {
  const content = rows.map((r) => `${r.name} ${r.formulaStr}`).join("\n");
  downloadTxt(content, filename);
}

function downloadErrorsTxt(rows, filename) {
  const content = rows
    .map((r) => `${r.name}\t${r.formulaStr}\t${r.error || "Could not be parsed (no specific reason given)."}`)
    .join("\n");
  downloadTxt(content, filename);
}
// Memoized so that unrelated state changes elsewhere in the app (e.g.
// picking a formula, which only updates the single-result view below) don't
// force React to re-diff every row of what can be a several-thousand-row
// mineral list — that reconciliation cost was the source of the lag.
// Shared between the frozen header table and the scrolling body table so
// their columns land at the same pixel boundaries — table-layout:fixed
// makes each <col> width authoritative regardless of that table's own
// content (a lone header table would otherwise auto-size differently than
// the body table sitting below it).
const BATCH_COL_WIDTHS = ["6%", "54%", "22%", "18%"];

// A single cached canvas 2D context, reused for every row's text-width
// measurement below — canvas.measureText() doesn't force a layout reflow
// the way reading a real DOM element's width would, so this stays cheap
// even across several thousand rows.
let measureCtx = null;
function getMeasureCtx() {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

// Strips the '^...^'/'_..._' delimiters down to their plain characters for
// width measurement. The real rendered <sup>/<sub> glyphs are smaller than
// this measures them at, so the estimate is conservative — it may shrink a
// row's font a little more than strictly necessary, but never leaves a row
// too wide to fit (which is what would force it to wrap or clip).
function plainFormulaText(str) {
  return str.replace(/[_^]/g, "");
}

const BATCH_ROW_MAX_FONT_SIZE = 14.5;
const BATCH_ROW_MIN_FONT_SIZE = 9;

// Picks the largest font size, up to the max, at which `text` fits on one
// line within `maxWidth` px — so a short formula keeps the normal size, and
// a long one shrinks just enough to still land on a single line instead of
// wrapping onto a second/third line of its own.
function fitFontSize(text, maxWidth, fontWeight = 400) {
  if (!maxWidth || !text) return BATCH_ROW_MAX_FONT_SIZE;
  const ctx = getMeasureCtx();
  ctx.font = `${fontWeight} ${BATCH_ROW_MAX_FONT_SIZE}px ${COLORS.mono}`;
  const width = ctx.measureText(text).width;
  if (width <= maxWidth) return BATCH_ROW_MAX_FONT_SIZE;
  return Math.max(BATCH_ROW_MIN_FONT_SIZE, (BATCH_ROW_MAX_FONT_SIZE * maxWidth) / width);
}

function BatchColgroup() {
  return (
    <colgroup>
      {BATCH_COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

const BatchTable = memo(function BatchTable({ rows, onRowClick, selectedIds, onToggleSelect, onToggleSelectAll }) {
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const scrollRef = useRef(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);

  // The "Mineral" column's own content width (its <th>'s width minus the
  // cell's own left/right padding) — measured once here and reused for
  // every row's fitFontSize() call below, rather than measuring each row's
  // cell individually.
  const mineralColRef = useRef(null);
  const [mineralColWidth, setMineralColWidth] = useState(0);

  useLayoutEffect(() => {
    const el = mineralColRef.current;
    if (!el) return;
    const measure = () => setMineralColWidth(el.clientWidth - 28);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const headerThStyle = {
    padding: "9px 14px",
    color: COLORS.textDim,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.panelAlt,
  };

  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ paddingRight: scrollbarWidth, background: COLORS.panelAlt }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13 }}>
          <BatchColgroup />
          <thead>
            <tr>
              <th style={{ ...headerThStyle, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => onToggleSelectAll(rows)}
                  title="Select all visible"
                  style={{ cursor: "pointer" }}
                />
              </th>
              {["Mineral", "Formula mass", "Net charge"].map((h, idx) => (
                <th
                  key={h}
                  ref={idx === 0 ? mineralColRef : undefined}
                  style={{ ...headerThStyle, textAlign: idx === 0 ? "left" : "center" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <div ref={scrollRef} style={{ maxHeight: 420, overflowY: "auto", transform: "translateZ(0)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13 }}>
          <BatchColgroup />
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick(r)}
                style={{
                  background: idx % 2 ? "transparent" : "rgba(0,0,0,0.025)",
                  cursor: "pointer",
                }}
              >
                <td style={{ ...tdStyle, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => onToggleSelect(r.id)}
                    style={{ cursor: "pointer" }}
                  />
                </td>
                <td style={{ ...tdStyle, textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: BATCH_ROW_MAX_FONT_SIZE }}>
                    {r.name}
                    {r.name && ","}
                  </div>
                  <div
                    style={{
                      color: COLORS.textDim,
                      fontSize: fitFontSize(plainFormulaText(r.formulaStr), mineralColWidth),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      marginTop: 2,
                    }}
                  >
                    {renderFormula(r.formulaStr)}
                  </div>
                </td>
                {r.error ? (
                  <td colSpan={2} style={{ ...tdStyle, color: COLORS.warn }}>
                    {r.error}
                  </td>
                ) : r.result.isRange ? (
                  <>
                    <td style={tdStyle}>
                      {r.result.columns[0].totalMass.toFixed(3)}–
                      {r.result.columns[1].totalMass.toFixed(3)} g/mol
                    </td>
                    <td style={tdStyle}>
                      {r.result.columns[0].isMetallic
                        ? "—"
                        : `${r.result.columns[0].netCharge.toFixed(3)}–${r.result.columns[1].netCharge.toFixed(3)}`}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{r.result.totalMass.toFixed(3)} g/mol</td>
                    <td
                      style={{
                        ...tdStyle,
                        color:
                          !r.result.isMetallic && Math.abs(r.result.netCharge) > 0.001
                            ? COLORS.warn
                            : COLORS.text,
                      }}
                    >
                      {r.result.isMetallic ? "—" : r.result.netCharge.toFixed(3)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: 16, color: COLORS.textDim, fontSize: 13 }}>No matches.</div>
      )}
    </div>
  );
});

const ErrorsPanel = memo(function ErrorsPanel({ rows, onDownload }) {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <div style={{ marginTop: 14 }}>
        <button
          onClick={() => setHidden(false)}
          style={{
            background: "transparent",
            border: `1px solid ${COLORS.warn}`,
            color: COLORS.warn,
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 11.5,
            cursor: "pointer",
          }}
        >
          Show {rows.length} error{rows.length === 1 ? "" : "s"}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: 8,
        background: "#fbeee5",
        border: `1px solid ${COLORS.warn}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div style={{ color: COLORS.warn, fontSize: 12.5, fontWeight: 600 }}>
          {rows.length} mineral{rows.length === 1 ? "" : "s"} could not be parsed:
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onDownload(rows, "mineral-errors.txt")}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.warn}`,
              color: COLORS.warn,
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11.5,
              cursor: "pointer",
            }}
          >
            Download (.txt)
          </button>
          <button
            onClick={() => setHidden(true)}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.warn}`,
              color: COLORS.warn,
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11.5,
              cursor: "pointer",
            }}
          >
            Hide
          </button>
        </div>
      </div>
      <div
        style={{
          color: COLORS.text,
          fontSize: 12.5,
          fontFamily: COLORS.mono,
          lineHeight: 1.7,
        }}
      >
        {rows.map((r) => r.name).join(", ")}
      </div>
    </div>
  );
});

