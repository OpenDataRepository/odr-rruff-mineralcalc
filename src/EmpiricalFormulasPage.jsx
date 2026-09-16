import React, { useEffect, useMemo, useState } from "react";
import { COLORS, backButtonStyle } from "./shared.jsx";
import { SummaryView, SummaryDetail } from "./SummaryView.jsx";
import { analyze } from "./MineralFormulaParser.jsx";
import { parseChemicalFormula, isFormulaFormatted } from "./odrChemistryFormat.js";
import { loadCitationsForMineral } from "./cellparamsLoader.js";

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
// what lets "NaPb2(CO3)2(OH)" and "Na Pb2 (O7 C2) H" (row 2 and row 4 on
// this page) register as the same underlying chemistry despite being
// written completely differently.
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
function buildEmpiricalRows(name, citations) {
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

// Page 3: every known published formula for one mineral, side by side in
// the same "(1)"/"(2)"/... comparison table SummaryView already builds for
// a Type 1 range — just handed more than two columns.
export default function EmpiricalFormulasPage({ onBack, mineralId }) {
  // `mineralId` (the RRUFF cellparams outer hash key, see
  // scripts/lookup-cellparams.mjs) is threaded through from the URL's "ID"
  // param via App.jsx/LandingPage.jsx. Real citation rows are fetched from
  // RRUFF's own cellparams scripts (see cellparamsLoader.js) whenever it's
  // present. `undefined` = not resolved yet; `null` = resolved, mineralId
  // has no cellparams records; an object = resolved with data. Both `null`
  // and "not yet fetched" used to share the same falsy state, so isLoading
  // could never tell "found nothing" apart from "still working" — a
  // mineralId with zero records spun on "Loading citation data…" forever.
  const [fetched, setFetched] = useState(undefined);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!mineralId) return;
    let cancelled = false;
    setFetched(undefined);
    setFetchError(null);
    loadCitationsForMineral(mineralId)
      .then((result) => {
        if (!cancelled) setFetched(result);
      })
      .catch((e) => {
        if (!cancelled) setFetchError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mineralId]);

  // `name` stays undefined when there's no mineralId, or when one is set
  // but nothing came back for it — harmless, since it's only used to build
  // rows (empty either way) and as SummaryView's title, which never renders
  // when there are no rows to show.
  const name = fetched?.mineralName;
  const citations = fetched?.citations || [];

  const rows = useMemo(() => buildEmpiricalRows(name, citations), [name, citations]);
  const isLoading = Boolean(mineralId) && fetched === undefined && !fetchError;

  const [openRowIndex, setOpenRowIndex] = useState(null);

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
      {/* Wider than page 1's 780 — this page's table grows with the number
          of citation formulas (see SummaryView's tableWidth), so the page
          itself needs the room instead of forcing an early squeeze. */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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
            Empirical Formula Weights
          </h1>
          {onBack && (
            <button onClick={onBack} style={{ ...backButtonStyle, flexShrink: 0 }}>
              ← Back
            </button>
          )}
        </div>

        {isLoading && (
          <div style={{ fontSize: 14, color: COLORS.text }}>Loading citation data…</div>
        )}

        {fetchError && (
          <div style={{ fontSize: 14, color: COLORS.warn }}>
            Couldn't load citation data: {fetchError}
          </div>
        )}

        {!isLoading && !fetchError && rows.length === 0 && (
          <div style={{ fontSize: 14, color: COLORS.text }}>
            Couldn't find any empirical formulas.
          </div>
        )}

        {!isLoading && !fetchError && rows.length > 0 && (
          openRowIndex !== null ? (
            <SummaryDetail
              result={rows[openRowIndex].result}
              onBack={() => setOpenRowIndex(null)}
            />
          ) : (
            <SummaryView
              title={name}
              formulaStr={rows[0].formulaStr}
              rows={rows}
              onSelect={setOpenRowIndex}
            />
          )
        )}
      </div>
    </div>
  );
}
