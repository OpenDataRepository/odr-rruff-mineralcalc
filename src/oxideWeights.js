import { ELEMENTS } from "./elements.js";

// Oxide weight percents (per Bob Downs, "Oxide weight percent calculations",
// 11/9/2026). Each cation is reported as its neutral oxide instead of as a
// bare atom:
//   M1+ -> M2O    M2+ -> MO    M3+ -> M2O3    M4+ -> MO2
//   M5+ -> M2O5   M6+ -> MO3  (and so on: odd valence v -> M2Ov, even -> MO(v/2))
// so e.g. Na in NaPb2(CO3)2(OH) becomes 0.5 Na2O and H becomes 0.5 H2O.
//
// That only accounts for every O when the formula charge balances and O^2-
// is the only anion, so for now anything else gets no oxide table (null):
// a non-zero net charge, any other negatively charged atom (F, Cl, S2-…),
// peroxide-style O (a valence other than -2), a fractional or unknown
// cation valence, an unrecognized element, or a native element/metal.
const BALANCE_TOLERANCE = 1e-3;

function oxideFormula(symbol, valence) {
  const metalCount = valence % 2 ? 2 : 1;
  const oxygenCount = valence % 2 ? valence : valence / 2;
  const sub = (n) => (n === 1 ? "" : `_${n}_`);
  return `${symbol}${sub(metalCount)}O${sub(oxygenCount)}`;
}

export function computeOxides(result) {
  if (!result || result.isRange || result.isMetallic) return null;
  if (Math.abs(result.netCharge) > BALANCE_TOLERANCE) return null;
  if (!result.totalMass) return null;

  // ELEMENTS is overwritten by the ODR element table once it loads, so O's
  // weight is read now rather than when this module is imported.
  const oWeight = ELEMENTS.O.weight;
  const oxides = [];
  const bySignature = new Map();
  let hasOxygen = false;
  for (const a of result.atoms) {
    if (!a.count) continue;
    if (!a.known || !a.weight) return null;
    if (a.symbol === "O") {
      if (a.valence !== -2) return null;
      hasOxygen = true;
      continue;
    }
    if (typeof a.valence !== "number" || !Number.isInteger(a.valence) || a.valence <= 0) return null;
    const key = `${a.symbol}|${a.valence}`;
    let oxide = bySignature.get(key);
    if (!oxide) {
      const metalCount = a.valence % 2 ? 2 : 1;
      const oxygenCount = a.valence % 2 ? a.valence : a.valence / 2;
      oxide = {
        symbol: a.symbol,
        valence: a.valence,
        formula: oxideFormula(a.symbol, a.valence),
        metalCount,
        weight: metalCount * a.weight + oxygenCount * oWeight,
        count: 0,
      };
      bySignature.set(key, oxide);
      oxides.push(oxide);
    }
    oxide.count += a.count / oxide.metalCount;
  }
  if (!hasOxygen || oxides.length === 0) return null;

  // Charge balance with O^2- as the only anion means the oxides use exactly
  // the formula's O, so their summed mass is the same formula mass and the
  // percents are taken against it, just like the atomic weight percents.
  return oxides.map((o) => ({
    ...o,
    totalMass: o.count * o.weight,
    percent: (o.count * o.weight * 100) / result.totalMass,
  }));
}
