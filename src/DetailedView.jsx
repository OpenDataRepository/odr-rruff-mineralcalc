import React, { memo } from "react";
import { COLORS, renderFormula, backButtonStyle } from "./shared.jsx";

const detailTdStyle = {
  padding: "7px 4px",
  textAlign: "center",
  fontFamily: COLORS.mono,
  borderBottom: `1px solid ${COLORS.border}`,
};

const detailThStyle = {
  textAlign: "center",
  padding: "9px 4px",
  color: COLORS.textDim,
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: `1px solid ${COLORS.border}`,
};

// Every header gets a second line (a hidden placeholder where there's no
// unit) so all header cells share the same height — otherwise the two-line
// "Atomic mass" / "Total mass" headers make the single-line ones look
// unevenly padded next to them.
const DETAIL_HEADERS = [
  { label: "Element" },
  { label: "Valence" },
  { label: "Count" },
  { label: "Atomic mass", unit: "(g/mol)" },
  { label: "Total mass", unit: "(g/mol)" },
  { label: "% of mass" },
];

function Stat({ label, value, warn }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "10px 16px",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: COLORS.textDim,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: COLORS.mono,
          fontSize: 15,
          fontWeight: 600,
          color: warn ? COLORS.warn : COLORS.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function valenceLabel(a) {
  return a.valence === null || a.valence === undefined
    ? "—"
    : (a.valence > 0 ? "+" : "") + a.valence.toFixed(1);
}

const DETAIL_HEADERS_METALLIC = DETAIL_HEADERS.filter((h) => h.label !== "Valence");
const DETAIL_COL_WIDTHS = [14, 16, 14, 19, 19, 18];
const DETAIL_COL_WIDTHS_METALLIC = [16, 16, 22, 22, 24];

// Atomic/molar mass is grams per mole (g/mol) — a formula unit's mass
// divided by how many moles of it you have — not g/cm^3, which is density
// (mass per unit volume) and isn't something this table computes.
//
// A ranged (Type 1) formula never reaches this component directly — the
// caller picks a single end-member column out first (see pickColumn in
// MineralFormulaParser.jsx) via the summary view, so `result` here always
// describes one concrete composition.
const DetailedView = memo(function DetailedView({ result, onBack }) {
  // Native metals (e.g. Cu, Au) aren't ionic — reporting a per-atom valence
  // or a "net charge" for them is meaningless, so both are hidden and only
  // the atomic weight percents are shown. See isMetallicFormula in
  // MineralFormulaParser.jsx.
  const showValence = !result.isMetallic;
  const headers = showValence ? DETAIL_HEADERS : DETAIL_HEADERS_METALLIC;
  const colWidths = showValence ? DETAIL_COL_WIDTHS : DETAIL_COL_WIDTHS_METALLIC;
  return (
    <div style={{ maxWidth: 640, margin: "22px auto 0" }}>
      {(result.name || onBack) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 2,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {result.name}
            {result.name && ", "}
            {renderFormula(result.formulaStr)}
          </div>
          {onBack && (
            <button onClick={onBack} style={{ ...backButtonStyle, flexShrink: 0 }}>
              ← Back to summary
            </button>
          )}
        </div>
      )}
      <div
        style={{
          fontFamily: COLORS.mono,
          fontSize: 15,
          color: COLORS.textDim,
          marginBottom: 16,
          wordBreak: "break-all",
        }}
      >
        Valence Formula: {result.formulaStr}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <Stat label="Formula mass" value={`${result.totalMass.toFixed(3)} g/mol`} />
        {showValence && (
          <Stat
            label="Net charge"
            value={result.netCharge.toFixed(3)}
            warn={Math.abs(result.netCharge) > 0.001}
          />
        )}
      </div>

      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", maxWidth: 640 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13.5 }}>
          <colgroup>
            {colWidths.map((w, idx) => (
              <col key={idx} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: COLORS.panelAlt }}>
              {headers.map(({ label, unit }) => (
                <th key={label} style={detailThStyle}>
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <span>{label}</span>
                    {unit && <span style={{ textTransform: "none" }}>{unit}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.atoms.map((a, idx) => (
              <tr key={idx} style={{ background: idx % 2 ? "transparent" : "rgba(0,0,0,0.025)" }}>
                <td style={{ ...detailTdStyle, fontWeight: 600 }}>
                  {a.symbol}
                  {!a.known && (
                    <span style={{ color: COLORS.warn, marginLeft: 6, fontSize: 11 }}>unknown</span>
                  )}
                </td>
                {showValence && <td style={detailTdStyle}>{valenceLabel(a)}</td>}
                <td style={detailTdStyle}>{a.count.toFixed(3)}</td>
                <td style={detailTdStyle}>{a.weight ? a.weight.toFixed(3) : "—"}</td>
                <td style={detailTdStyle}>{a.totalMass.toFixed(3)}</td>
                <td style={{ ...detailTdStyle, color: COLORS.accent }}>{a.percent.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...detailTdStyle, fontWeight: 700, borderTop: `2.5px solid ${COLORS.textDim}`, borderBottom: "none" }}>
                Total
              </td>
              {Array.from({ length: headers.length - 3 }, (_, idx) => (
                <td key={idx} style={{ ...detailTdStyle, borderTop: `2.5px solid ${COLORS.textDim}`, borderBottom: "none" }} />
              ))}
              <td
                style={{
                  ...detailTdStyle,
                  fontWeight: 700,
                  borderTop: `2.5px solid ${COLORS.textDim}`,
                  borderBottom: "none",
                }}
              >
                {result.totalMass.toFixed(3)}
              </td>
              <td
                style={{
                  ...detailTdStyle,
                  color: COLORS.accent,
                  fontWeight: 700,
                  borderTop: `2.5px solid ${COLORS.textDim}`,
                  borderBottom: "none",
                }}
              >
                100.000
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

export default DetailedView;
