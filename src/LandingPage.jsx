import React, { useMemo, useState } from "react";
import { COLORS } from "./shared.jsx";
import { SummaryView, SummaryDetail, FormulaHeader } from "./SummaryView.jsx";
import { analyze, pickColumn, EXAMPLES } from "./MineralFormulaParser.jsx";

// The first thing visitors see: a fully computed breakdown for one mineral
// (picked from the URL's "mineral"/"formula" params if present, otherwise
// EXAMPLES[0]). The formula field below is editable so a quick tweak updates
// this same page live; "Custom Mineral" is the way into the full page-2
// editor (name field, batch upload, etc.), carrying over whatever formula is
// currently typed here.
export default function LandingPage({ onEdit }) {
  const [name, initialFormulaStr] = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const mineral = params.get("mineral");
    const formula = params.get("formula");
    if (mineral && formula) return [mineral, formula];
    return EXAMPLES[0].split("\t");
  }, []);

  const [formulaInput, setFormulaInput] = useState(initialFormulaStr);

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
    return [
      { formulaStr: result.columns[0].formulaStr, result: result.columns[0] },
      { formulaStr: result.columns[1].formulaStr, result: result.columns[1] },
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
              formulaStr={result.formulaStr}
              rows={topSummaryRows}
              onSelect={setOpenColumnIndex}
            />
          )
        )}

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 600 }}>
            Formatted formula: with subscripts inside of pairs of underscores, eg _2_, and superscripts inside of a pair of carets, eg ^2+^
          </label>
          <textarea
            value={formulaInput}
            onChange={(e) => setFormulaInput(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="Pb^2+^_2_(CO_3_)_2_(OH)"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: "12px 14px",
              color: COLORS.text,
              fontFamily: COLORS.mono,
              fontSize: 14.5,
              resize: "vertical",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginTop: 12, textAlign: "right" }}>
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
            Custom Mineral
          </button>
        </div>
      </div>
    </div>
  );
}
