import React, { memo, useMemo } from "react";
import { COLORS, renderFormula } from "./shared.jsx";
import DetailedView from "./DetailedView.jsx";

const backButtonStyle = {
  background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
};

function summaryThStyle(align) {
  return {
    textAlign: align,
    padding: "6px 2px",
    color: COLORS.textDim,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: `1px solid ${COLORS.border}`,
    whiteSpace: "nowrap",
  };
}

const summaryTdStyle = {
  padding: "4px 2px",
  textAlign: "center",
  fontFamily: COLORS.mono,
  borderBottom: `1px solid ${COLORS.border}`,
};

const summaryHeaderBtnStyle = {
  background: "transparent",
  border: "none",
  color: COLORS.accent,
  fontWeight: 700,
  fontSize: 12.5,
  fontFamily: COLORS.mono,
  cursor: "pointer",
  padding: 0,
  margin: 0,
  lineHeight: "normal",
};

const summaryKeyBtnStyle = {
  background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.accent,
  borderRadius: 6,
  padding: "2px 8px",
  fontSize: 11.5,
  fontFamily: COLORS.mono,
  cursor: "pointer",
};

// Shows the union of elements across a set of formulas as rows, with one
// percent-of-mass column per formula (labeled (1), (2), ...). A formula
// missing an element that another has just gets a blank cell rather than a
// zero. `title`/`formulaStr` (the mineral name and its original, unresolved
// formula — the one with the range dash still in it) are shown once above
// the table; the key below only lists each column's own resolved formula.
// Used both as the simplified 2-column summary for a single mineral picked
// from the batch list, and reusable for a small explicit group.
export const SummaryView = memo(function SummaryView({ title, formulaStr, rows, onSelect, onBack }) {
  const elements = useMemo(() => {
    const seen = new Set();
    const order = [];
    for (const r of rows) {
      for (const a of r.result.atoms) {
        if (!seen.has(a.symbol)) {
          seen.add(a.symbol);
          order.push(a.symbol);
        }
      }
    }
    return order;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div style={{ marginTop: 14, padding: 16, color: COLORS.textDim, fontSize: 13 }}>
        No parseable formulas to summarize.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      {(title || formulaStr || onBack) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: onBack ? "space-between" : "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={onBack ? { maxWidth: 480 } : { textAlign: "center", maxWidth: 480 }}>
            {title && (
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
                {title}
                {formulaStr && ", "}
                {formulaStr && renderFormula(formulaStr)}
              </div>
            )}
            {formulaStr && (
              <div
                style={{
                  fontFamily: COLORS.mono,
                  fontSize: 15,
                  color: COLORS.textDim,
                  wordBreak: "break-all",
                }}
              >
                Valence Formula: {formulaStr}
              </div>
            )}
          </div>
          {onBack && (
            <button onClick={onBack} style={{ ...backButtonStyle, flexShrink: 0 }}>
              ← Back to list
            </button>
          )}
        </div>
      )}
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", maxWidth: 360, margin: "0 auto" }}>
        <div style={{ maxHeight: 420, overflow: "auto", transform: "translateZ(0)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13.5 }}>
            <colgroup>
              <col style={{ width: `${100 / (rows.length + 1)}%` }} />
              {rows.map((_, idx) => (
                <col key={idx} style={{ width: `${100 / (rows.length + 1)}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...summaryThStyle("center"), background: COLORS.panelAlt, position: "sticky", top: 0, zIndex: 1 }}>Element</th>
                {rows.map((r, idx) => (
                  <th
                    key={idx}
                    style={{ ...summaryThStyle("center"), background: COLORS.panelAlt, position: "sticky", top: 0, zIndex: 1 }}
                  >
                    <div>% of mass</div>
                    <button
                      onClick={() => onSelect(idx)}
                      style={summaryHeaderBtnStyle}
                      title={r.formulaStr}
                    >
                      ({idx + 1})
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elements.map((symbol, i) => (
                <tr
                  key={symbol}
                  style={{ background: i % 2 ? "transparent" : "rgba(0,0,0,0.025)" }}
                >
                  <td style={{ ...summaryTdStyle, fontWeight: 600 }}>{symbol}</td>
                  {rows.map((r, idx) => {
                    const atom = r.result.atoms.find((a) => a.symbol === symbol);
                    return (
                      <td key={idx} style={{ ...summaryTdStyle, color: COLORS.accent, fontWeight: 700 }}>
                        {atom ? atom.percent.toFixed(3) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  style={{
                    ...summaryTdStyle,
                    fontWeight: 700,
                    borderTop: `2.5px solid ${COLORS.textDim}`,
                  }}
                >
                  Net charge
                </td>
                {rows.map((r, idx) => (
                  <td
                    key={idx}
                    style={{
                      ...summaryTdStyle,
                      fontWeight: 700,
                      borderTop: `2.5px solid ${COLORS.textDim}`,
                      color: Math.abs(r.result.netCharge) > 0.001 ? COLORS.warn : undefined,
                    }}
                  >
                    {r.result.netCharge.toFixed(3)}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...summaryTdStyle, fontWeight: 700, borderBottom: "none" }}>
                  Formula mass
                </td>
                {rows.map((r, idx) => (
                  <td key={idx} style={{ ...summaryTdStyle, fontWeight: 700, borderBottom: "none" }}>
                    {r.result.totalMass.toFixed(3)} g/mol
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.9, maxWidth: 360, margin: "10px auto 0" }}>
        {rows.map((r, idx) => (
          <div key={idx}>
            <button onClick={() => onSelect(idx)} style={summaryKeyBtnStyle}>
              ({idx + 1})
            </button>{" "}
            <span style={{ fontFamily: COLORS.mono }}>{renderFormula(r.formulaStr)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// Detailed breakdown for a single formula picked out of the summary table,
// with a back button scoped to this block (not the page) so the summary
// comparison is a click away.
export const SummaryDetail = memo(function SummaryDetail({ result, onBack }) {
  return (
    <div style={{ marginTop: 14 }}>
      <DetailedView result={result} onBack={onBack} />
    </div>
  );
});
