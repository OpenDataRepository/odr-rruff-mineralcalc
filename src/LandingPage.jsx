import React, { useMemo, useState } from "react";
import { COLORS, displayFormulaStr } from "./shared.jsx";
import { SummaryView, SummaryDetail, FormulaHeader } from "./SummaryView.jsx";
import { analyze, pickColumn, EXAMPLES } from "./MineralFormulaParser.jsx";

// The first thing visitors see: a fully computed breakdown for one mineral
// (picked from the URL's "mineral"/"formula" params if present, otherwise
// EXAMPLES[0]). "Custom Formula" is the way into the full page-2 editor
// (name field, batch upload, etc.), carrying over the formula shown here.
// "Empirical Formulas" is the way into page 3 — every published formula for
// this mineral compared side by side.
export default function LandingPage({ onEdit, onViewEmpirical }) {
  const [name, formulaInput, mineralId] = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const mineral = params.get("mineral");
    const formula = params.get("formula");
    // The RRUFF cellparams outer hash key for this mineral (see
    // scripts/lookup-cellparams.mjs) — carried through to page 3 so its
    // citation table can be looked up by ID instead of by name.
    const id = params.get("ID");
    if (mineral && formula) return [mineral, formula, id];
    return [...EXAMPLES[0].split("\t"), null];
  }, []);

  const [error, result] = useMemo(() => {
    try {
      return [null, analyze(`${name}\t${formulaInput}`)];
    } catch (e) {
      return [e.message, null];
    }
  }, [name, formulaInput]);

  const topSummaryRows = useMemo(() => {
    if (!result) return null;
    if (!result.isRange) return [{ formulaStr: result.formulaStr, result }];
    // A range column's own result doesn't carry isModifiedIdeal (that flag
    // lives on the outer analyze() result) — copy it down so each row can
    // still show the "modified ideal formula" label regardless of range.
    return [
      { formulaStr: result.columns[0].formulaStr, result: { ...result.columns[0], isModifiedIdeal: result.isModifiedIdeal } },
      { formulaStr: result.columns[1].formulaStr, result: { ...result.columns[1], isModifiedIdeal: result.isModifiedIdeal } },
    ];
  }, [result]);

  const [openColumnIndex, setOpenColumnIndex] = useState(null);

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
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, paddingBottom: 8 }}>
            Formula Weights
          </h1>
        </div>

        {error && (
          <>
            <FormulaHeader title={name} formulaStr={formulaInput} />
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
          </>
        )}

        {result && !error && (
          openColumnIndex !== null ? (
            <SummaryDetail
              result={pickColumn(result, openColumnIndex)}
              onBack={() => setOpenColumnIndex(null)}
            />
          ) : (
            <SummaryView
              title={name}
              formulaStr={displayFormulaStr(result)}
              rows={topSummaryRows}
              onSelect={setOpenColumnIndex}
            />
          )
        )}

        <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <button
            onClick={() => onViewEmpirical(mineralId)}
            style={{
              background: COLORS.panelAlt,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Empirical Formulas
          </button>
          <button
            onClick={() => onEdit(name, formulaInput)}
            style={{
              background: COLORS.accent,
              border: "none",
              color: "#ffffff",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Custom Formula
          </button>
        </div>
      </div>
    </div>
  );
}
