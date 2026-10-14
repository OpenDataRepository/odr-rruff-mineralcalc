import React, { Fragment, useEffect, useMemo, useState } from "react";
import { COLORS, tdStyle, renderFormula } from "./shared.jsx";
import { loadAllCellparamsRecords, loadImaMineralList } from "./cellparamsLoader.js";
import { groupMinerals, computeAllFacts, METRICS, METRICS_BY_ID, IMPRECISE_REASONS } from "./formulaMetrics.js";

// The metrics page ([odr-rruff-mineralcalc-metrics]): every IMA list
// mineral's ideal formula and its citation formulas from RRUFF's cellparams
// data, run through the calculator's own parser, then counted side by side — what the
// calculator can't handle yet, how many formulas aren't precise, have a
// common divisor, don't charge balance, and so on. Clicking a count lists
// the formulas behind it; an IMA formula's row opens to show its citations.

const SOURCES = {
  ideal: { label: "Ideal IMA chemistry (valence formulas)" },
  empirical: { label: "Citation chemistry (as reported)" },
};
const PAGE_SIZE = 100;

const fmtCharge = (n) => (n == null ? "" : (Math.round(n * 1000) / 1000).toString());

// Flattens the per-mineral facts into one row per formula for each source.
// Ideal rows carry their mineral's citation rows along, for the expandable
// list.
function formulaRows(facts) {
  const rows = { ideal: [], empirical: [] };
  for (const m of facts) {
    const citations = m.empirical.map((f) => ({ mineral: m.name, mineralId: m.id, ...f }));
    rows.ideal.push({ mineral: m.name, mineralId: m.id, ...m.ideal, citations });
    rows.empirical.push(...citations);
  }
  return rows;
}

function countOf(rows, id) {
  return id ? rows.filter(METRICS_BY_ID.get(id).test).length : rows.length;
}

// What's wrong with a formula, in words, or "" if nothing.
function problemOf(r) {
  return [r.reason && IMPRECISE_REASONS[r.reason], r.modifiedIdeal && "approximated with each site's first element"]
    .filter(Boolean)
    .join("; ");
}

function Cell({ rows, metric, active, onClick }) {
  const n = countOf(rows, metric.id);
  const total = countOf(rows, metric.of);
  const pct = metric.of && total ? `${((100 * n) / total).toFixed(1)}%` : "";
  return (
    <td style={{ ...tdStyle, padding: 0 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          background: active ? COLORS.accentSoft : "transparent",
          border: "none",
          padding: "8px 14px",
          color: COLORS.text,
          fontFamily: COLORS.mono,
          fontSize: 14,
          textAlign: "right",
        }}
      >
        <span style={{ fontWeight: 600 }}>{n.toLocaleString()}</span>
        {metric.of && (
          <span style={{ color: COLORS.textDim, fontSize: 12, marginLeft: 8 }}>
            of {total.toLocaleString()}
            {pct && ` · ${pct}`}
          </span>
        )}
      </button>
    </td>
  );
}

function SummaryTable({ rows, selected, onSelect }) {
  const label = { ...tdStyle, textAlign: "left", fontFamily: "inherit" };
  return (
    <table style={{ width: "100%", border: `1px solid ${COLORS.border}`, background: COLORS.bg }}>
      <thead>
        <tr style={{ background: COLORS.panelAlt }}>
          <th style={{ ...label, fontWeight: 600 }}></th>
          {Object.entries(SOURCES).map(([key, s]) => (
            <th key={key} style={{ ...label, textAlign: "right", fontWeight: 600 }}>
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {METRICS.map((m) => (
          <Fragment key={m.id}>
            {m.section && (
              <tr>
                <td colSpan={3} style={{ ...label, background: COLORS.panel, fontWeight: 700, fontSize: 13 }}>
                  {m.section}
                </td>
              </tr>
            )}
            <tr>
              <td
                title={m.hint}
                style={{
                  ...label,
                  paddingLeft: m.sub ? 34 : 14,
                  color: m.sub ? COLORS.textDim : COLORS.text,
                  cursor: m.hint ? "help" : "default",
                }}
              >
                {m.label}
              </td>
              {Object.keys(SOURCES).map((source) => (
                <Cell
                  key={source}
                  rows={rows[source]}
                  metric={m}
                  active={selected.source === source && selected.metric === m.id}
                  onClick={() => onSelect({ source, metric: m.id })}
                />
              ))}
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

const th = { ...tdStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 600, background: COLORS.panel };
const td = { ...tdStyle, textAlign: "left" };
const smallButton = {
  background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12.5,
};

// The formula, problem, divisor, charge and oxygen cells shared by every
// list row (an ideal formula's or a citation's).
function FormulaCells({ r }) {
  return (
    <>
      <td style={{ ...td, overflowWrap: "anywhere" }}>{renderFormula(r.formulaStr || "")}</td>
      <td style={{ ...td, fontFamily: "inherit", color: COLORS.warn }}>
        {problemOf(r)}
        {r.error && <div style={{ fontSize: 11.5, color: COLORS.textDim, marginTop: 3 }}>{r.error}</div>}
      </td>
      <td style={{ ...td, textAlign: "right" }}>{r.divisor > 1 ? r.divisor : ""}</td>
      <td style={{ ...td, textAlign: "right", color: r.balanced === false ? COLORS.warn : COLORS.text }}>
        {fmtCharge(r.netCharge)}
      </td>
      <td style={td}>{r.hasOxygen ? "O" : ""}</td>
    </>
  );
}

// An ideal formula's citations, shown under its row when opened.
function CitationRows({ citations }) {
  if (!citations.length) {
    return (
      <tr>
        <td colSpan={7} style={{ ...td, fontFamily: "inherit", color: COLORS.textDim, paddingLeft: 34, background: COLORS.panel }}>
          No citation formulas
        </td>
      </tr>
    );
  }
  return citations.map((c, i) => (
    <tr key={i} style={{ background: COLORS.panel }}>
      <td style={{ ...td, fontFamily: "inherit", fontSize: 12.5, color: COLORS.textDim, paddingLeft: 34 }}>{c.reference}</td>
      <FormulaCells r={c} />
      <td style={td}></td>
    </tr>
  ));
}

function FormulaList({ rows, selected }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(() => new Set());
  useEffect(() => setPage(0), [selected, search]);

  const metric = METRICS_BY_ID.get(selected.metric);
  const isIdeal = selected.source === "ideal";
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows[selected.source]
      .filter(metric.test)
      .filter((r) => !q || [r.mineral, r.formulaStr, r.rawFormula].some((v) => v && v.toLowerCase().includes(q)));
  }, [rows, selected, metric, search]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const shown = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>
        {SOURCES[selected.source].label}: {metric.label}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mineral or formula"
          style={{ flex: "1 1 240px", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 13.5 }}
        />
        <span style={{ fontSize: 13, color: COLORS.textDim }}>
          {visible.length.toLocaleString()} formula{visible.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ overflowX: "auto", border: `1px solid ${COLORS.border}` }}>
        <table style={{ width: "100%", fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={th}>Mineral</th>
              <th style={th}>{isIdeal ? "Ideal IMA valence formula" : "Citation formula"}</th>
              <th style={th}>Problem</th>
              <th style={{ ...th, textAlign: "right" }}>Divisor</th>
              <th style={{ ...th, textAlign: "right" }}>Net charge</th>
              <th style={th}>O</th>
              <th style={th}>{isIdeal ? "Citations" : "Reference"}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <Fragment key={`${r.mineralId}-${i}`}>
                <tr>
                  <td style={{ ...td, fontFamily: "inherit" }}>{r.mineral}</td>
                  <FormulaCells r={r} />
                  {isIdeal ? (
                    <td style={td}>
                      <button type="button" style={smallButton} onClick={() => toggle(r.mineralId)}>
                        {open.has(r.mineralId) ? "▾" : "▸"} {r.citations.length}
                      </button>
                    </td>
                  ) : (
                    <td style={{ ...td, fontFamily: "inherit", fontSize: 12.5 }}>{r.reference}</td>
                  )}
                </tr>
                {isIdeal && open.has(r.mineralId) && <CitationRows citations={r.citations} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button type="button" style={smallButton} disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 13 }}>
            Page {page + 1} of {pages}
          </span>
          <button type="button" style={smallButton} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function MetricsPage() {
  const [status, setStatus] = useState("Loading RRUFF data…");
  const [error, setError] = useState(null);
  const [facts, setFacts] = useState(null);
  const [selected, setSelected] = useState({ source: "ideal", metric: "all" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [imaList, records] = await Promise.all([loadImaMineralList(), loadAllCellparamsRecords()]);
      const minerals = groupMinerals(imaList, records);
      const result = await computeAllFacts(minerals, (done, total) => {
        if (!cancelled) setStatus(`Checking formulas… ${done.toLocaleString()} of ${total.toLocaleString()} minerals`);
      });
      if (!cancelled) setFacts(result);
    })().catch((e) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => (facts ? formulaRows(facts) : null), [facts]);

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
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 20px" }}>Formula Metrics</h1>
        {error ? (
          <div style={{ color: COLORS.warn, fontSize: 14 }}>Couldn't load RRUFF data: {error}</div>
        ) : !rows ? (
          <div style={{ fontSize: 14 }}>{status}</div>
        ) : (
          <>
            <SummaryTable rows={rows} selected={selected} onSelect={setSelected} />
            <FormulaList rows={rows} selected={selected} />
          </>
        )}
      </div>
    </div>
  );
}
