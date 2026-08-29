import React, { memo, useMemo } from "react";
import { COLORS, renderFormula, backButtonStyle } from "./shared.jsx";
import DetailedView from "./DetailedView.jsx";
import { formatDetailText, downloadTxt } from "./reportText.js";

const downloadButtonStyle = {
  background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
};

// Builds the same plain-text report a batch "Print Report" row gets, but for
// this one mineral — one section per row (two, "(1)"/"(2)", for a range
// formula) — and triggers the download. Each row's `result` only carries a
// `name` when it came straight from analyze() (the non-range case); a
// range's per-column result doesn't, so it's filled in from `title` here.
function downloadMineralReport(title, rows) {
  const content = rows
    .map((r) => formatDetailText({ ...r.result, name: r.result.name || title }))
    .join("\n\n" + "=".repeat(60) + "\n\n");
  const safeName = (title || "mineral").replace(/[^\w.-]+/g, "_");
  downloadTxt(content, `${safeName}.txt`);
}

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

// The mineral name + formatted formula + raw "Valence Formula: ..." line
// shown above a summary table — also used on its own (e.g. Page 1's error
// state) so a formula that failed to parse still displays what was typed
// instead of disappearing along with the table.
export const FormulaHeader = memo(function FormulaHeader({ title, formulaStr, onBack }) {
  if (!title && !formulaStr && !onBack) return null;
  return (
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
  );
});

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

  // Native metals (e.g. Cu, Au) aren't ionic — a "net charge" is meaningless
  // for them, so it's hidden and only atomic weight percents are shown. See
  // isMetallicFormula in MineralFormulaParser.jsx.
  const isMetallic = rows.every((r) => r.result.isMetallic);

  if (rows.length === 0) {
    return (
      <div style={{ marginTop: 14, padding: 16, color: COLORS.textDim, fontSize: 13 }}>
        No parseable formulas to summarize.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <FormulaHeader title={title} formulaStr={formulaStr} onBack={onBack} />
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
              {!isMetallic && (
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
              )}
              <tr>
                <td
                  style={{
                    ...summaryTdStyle,
                    fontWeight: 700,
                    borderTop: isMetallic ? `2.5px solid ${COLORS.textDim}` : "none",
                    borderBottom: "none",
                  }}
                >
                  Formula mass
                </td>
                {rows.map((r, idx) => (
                  <td
                    key={idx}
                    style={{
                      ...summaryTdStyle,
                      fontWeight: 700,
                      borderTop: isMetallic ? `2.5px solid ${COLORS.textDim}` : "none",
                      borderBottom: "none",
                    }}
                  >
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

      <div style={{ marginTop: 18, textAlign: "right" }}>
        <button onClick={() => downloadMineralReport(title, rows)} style={downloadButtonStyle}>
          Print Report (.txt)
        </button>
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
