import React, { memo } from "react";
import { COLORS, renderFormula, renderMineralName, backButtonStyle, displayFormulaStr } from "./shared.jsx";
import { computeOxides } from "./oxideWeights.js";
import { useWeightView } from "./weightView.js";

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
        padding: "10px 12px",
        // Sized by content so a longer label ("Cations (M) excluding H")
        // gets the room it needs; the label wraps only on a narrow screen.
        flex: "1 1 auto",
        minWidth: 0,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          whiteSpace: "normal",
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

// Valences are integers except when a bracketed group's charge is split across
// its atoms (e.g. (O2)^1-^ gives -0.5 each), so only those keep any decimals.
export function valenceLabel(a) {
  return a.valence === null || a.valence === undefined
    ? "—"
    : (a.valence > 0 ? "+" : "") + Number(a.valence.toFixed(2));
}

// The oxide table lines its columns up under the atom table's, with the
// oxide in the first column and no valence column.
const OXIDE_HEADERS = [
  { label: "Oxide" },
  { label: "Count" },
  { label: "Molar mass", unit: "(g/mol)" },
  { label: "Total mass", unit: "(g/mol)" },
  { label: "% of mass" },
];

function HeaderRow({ headers }) {
  return (
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
  );
}

// Switches the table between the atomic weight percents and the oxide weight
// percents. Drawn as folder tabs joined to the table's top edge: the active
// tab shares the table header's color and covers the table's top border
// under it, so it reads as part of the table. The table beside it squares
// off its top-left corner (TABBED_TABLE_RADIUS) to meet the first tab.
export const TABBED_TABLE_RADIUS = "0 10px 10px 10px";

export function ViewTabs({ view, onChange }) {
  const tabs = [
    { id: "atoms", label: "Elements" },
    { id: "oxides", label: "Oxides" },
  ];
  return (
    <div role="tablist" style={{ display: "flex", gap: 2, marginBottom: -1, position: "relative", zIndex: 4 }}>
      {tabs.map((t) => {
        const active = view === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={{
              background: active ? COLORS.panelAlt : COLORS.bg,
              color: active ? COLORS.accent : COLORS.textDim,
              border: `1px solid ${COLORS.border}`,
              borderBottom: `1px solid ${active ? COLORS.panelAlt : COLORS.border}`,
              borderRadius: "8px 8px 0 0",
              padding: "6px 16px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Oxide weight percents: each cation as its neutral oxide (Na -> Na2O,
// Si -> SiO2…). Shown only when the formula charge balances with O as its
// only anion — see computeOxides.
function OxideTable({ oxides, totalMass }) {
  // Only ever shown under the tabs, so its top-left corner always meets them.
  const footStyle = { ...detailTdStyle, borderTop: `2.5px solid ${COLORS.textDim}`, borderBottom: "none" };
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: TABBED_TABLE_RADIUS, overflow: "hidden", maxWidth: 640 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13.5 }}>
        <colgroup>
          {DETAIL_COL_WIDTHS_METALLIC.map((w, idx) => (
            <col key={idx} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <HeaderRow headers={OXIDE_HEADERS} />
        </thead>
        <tbody>
          {oxides.map((o, idx) => (
            <tr key={idx} style={{ background: idx % 2 ? "transparent" : "rgba(0,0,0,0.025)" }}>
              <td style={{ ...detailTdStyle, fontWeight: 600 }}>{renderFormula(o.formula)}</td>
              <td style={detailTdStyle}>{o.count.toFixed(3)}</td>
              <td style={detailTdStyle}>{o.weight.toFixed(3)}</td>
              <td style={detailTdStyle}>{o.totalMass.toFixed(3)}</td>
              <td style={{ ...detailTdStyle, color: COLORS.accent }}>{o.percent.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...footStyle, fontWeight: 700 }}>Total</td>
            <td style={footStyle} />
            <td style={footStyle} />
            <td style={{ ...footStyle, fontWeight: 700 }}>{totalMass.toFixed(3)}</td>
            <td style={{ ...footStyle, color: COLORS.accent, fontWeight: 700 }}>100.000</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
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
const DetailedView = memo(function DetailedView({ result, citation, onBack }) {
  // Native metals (e.g. Cu, Au) aren't ionic — reporting a per-atom valence
  // or a "net charge" for them is meaningless, so both are hidden and only
  // the atomic weight percents are shown. See isMetallicFormula in
  // MineralFormulaParser.jsx.
  const showValence = !result.isMetallic;
  const headers = showValence ? DETAIL_HEADERS : DETAIL_HEADERS_METALLIC;
  const colWidths = showValence ? DETAIL_COL_WIDTHS : DETAIL_COL_WIDTHS_METALLIC;
  // Cations (M) and anions (X) are the summed counts of the atoms with a
  // positive or negative valence; atoms with no known valence count as neither.
  // H is left out of the cations, the way the literature totals them.
  const oxides = computeOxides(result);
  // Which table is showing. The Oxides tab only exists when computeOxides
  // could produce one; otherwise the element table is all there is.
  const [view, setView] = useWeightView();
  const showOxides = oxides && view === "oxides";
  let cationCount = 0;
  let anionCount = 0;
  for (const a of result.atoms) {
    if (a.valence > 0) {
      if (a.symbol !== "H") cationCount += a.count;
    } else if (a.valence < 0) anionCount += a.count;
  }
  return (
    <div style={{ maxWidth: 640, margin: "22px auto 0" }}>
      {(result.name || onBack) && (
        // The heading is allowed to grow past the 640px column, spreading
        // evenly to both sides (up to the page width) so a long formula uses
        // the space left of the table too. A short one stays exactly the
        // column's width, lined up with the table. Anything longer than the
        // page wraps between elements (see renderFormula).
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 2,
            width: "max-content",
            minWidth: "100%",
            maxWidth: "calc(100vw - 48px)",
            position: "relative",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, minWidth: 0 }}>
            {result.name && <div>{renderMineralName(result.name)},</div>}
            <div>{renderFormula(displayFormulaStr(result))}</div>
            {citation && (
              <div style={{ fontSize: 12.5, fontWeight: 400, color: COLORS.textDim, marginTop: 4, paddingBottom: 6 }}>
                {citation}
              </div>
            )}
          </div>
          {onBack && (
            <button onClick={onBack} style={{ ...backButtonStyle, flexShrink: 0 }}>
              ← Back to summary
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Stat label="Formula mass" value={`${result.totalMass.toFixed(3)} g/mol`} />
        {showValence && (
          <Stat
            label="Net charge"
            value={result.netCharge.toFixed(3)}
            warn={Math.abs(result.netCharge) > 0.001}
          />
        )}
        {showValence && <Stat label="Cations (M) excluding H" value={cationCount.toFixed(3)} />}
        {showValence && <Stat label="Anions (X)" value={anionCount.toFixed(3)} />}
      </div>

      {oxides && <ViewTabs view={view} onChange={setView} />}

      {showOxides ? (
        <OxideTable oxides={oxides} totalMass={result.totalMass} />
      ) : (
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: oxides ? TABBED_TABLE_RADIUS : 10,
            overflow: "hidden",
            maxWidth: 640,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13.5 }}>
            <colgroup>
              {colWidths.map((w, idx) => (
                <col key={idx} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
            <thead>
              <HeaderRow headers={headers} />
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
      )}
    </div>
  );
});

export default DetailedView;
