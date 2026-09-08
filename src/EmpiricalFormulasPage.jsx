import React, { useEffect, useMemo, useState } from "react";
import { COLORS, backButtonStyle } from "./shared.jsx";
import { SummaryView, SummaryDetail } from "./SummaryView.jsx";
import { analyze, EXAMPLES } from "./MineralFormulaParser.jsx";
import { parseChemicalFormula, isFormulaFormatted } from "./odrChemistryFormat.js";
import { loadCitationsForMineral } from "./cellparamsLoader.js";

// Placeholder for the citation-table API described in mineralDataSources.js
// (not wired up yet — see SHOW_API_LOADER in MineralFormulaParser.jsx for
// the same "ready but nothing to point it at" state). Until that exists,
// this is Abellaite's own row of citations, each with its formula exactly
// as that source published it — same mixed plain-text formatting (decimals,
// stray spaces, differently grouped parens, no valence markup) a real API
// row will have, so this page can already exercise the plain-formula
// conversion step it'll need. `cell` is the reported unit-cell (Å /
// degrees), kept alongside the formula for display/future use even though
// dedupeCitationRows below only keys on the formula itself. `citation` is
// the reference string dedupeCitationRows uses to pick the older of two
// duplicate formulas.
const EMPIRICAL_CITATIONS_BY_MINERAL = {
  Abellaite: [
    {
      formula: "Na0.96Ca0.04Pb1.98(CO3)2(OH)",
      cell: { a: 5.260, b: 5.260, c: 13.463, alpha: 90, beta: 90, gamma: 120 },
      citation: "Mineralogical Magazine 80 (2016) 199-205",
    },
    {
      formula: "NaPb2(CO3)2(OH)",
      cell: { a: 5.273, b: 5.273, c: 13.448, alpha: 90, beta: 90, gamma: 120 },
      citation: "Canadian Journal of Chemistry 61 (1983) 494-502",
    },
    {
      formula: "Na0.96Ca0.04Pb1.98(CO3)2(OH)",
      cell: { a: 5.254, b: 5.254, c: 13.450, alpha: 90, beta: 90, gamma: 120 },
      citation: "R250095",
    },
    {
      formula: "Na Pb2 (O7 C2) H",
      cell: { a: 5.276, b: 5.276, c: 13.474, alpha: 90, beta: 90, gamma: 120 },
      citation: "Mineralogical Magazine 64 (2000) 1077-1087",
    },
    {
      formula: "Na Pb2 C2 (O7 H)",
      cell: { a: 5.268, b: 5.268, c: 13.48, alpha: 90, beta: 90, gamma: 120 },
      citation: "Crystallography Reports 47 (2002) 217-222",
    },
    {
      formula: "Na Pb2 C2 O10 H",
      cell: { a: 5.254, b: 5.254, c: 13.450, alpha: 90, beta: 90, gamma: 120 },
      citation: "European Journal of Mineralogy 29 (2017) 915-922",
    },
  ],
};

// Only Abellaite has a hardcoded citation list right now — see the comment
// above. The canonical name/formula (shown next to "Empirical Formulas" the
// same way it's shown on the main results page) comes from EXAMPLES so the
// two pages can't drift apart.
const [CANONICAL_NAME, CANONICAL_FORMULA] = EXAMPLES[0].split("\t");

// A citation is either a free-text reference ending in "(YYYY) pages" (the
// common journal-citation shape) or a bare RRUFF sample ID. An RRUFF ID is
// "Rxxyyyy" — the two-digit xx is the sample's 20xx submission year (e.g.
// "R250095" was submitted in 2025), yyyy is just that year's running
// sequence number and carries no date information of its own. Returns null
// when neither shape matches, since there's nothing to safely guess at.
export function citationYear(citation) {
  const rruffMatch = /^R(\d{2})\d{4}$/i.exec(citation.trim());
  if (rruffMatch) return 2000 + Number(rruffMatch[1]);
  const yearMatch = /\((\d{4})\)/.exec(citation);
  return yearMatch ? Number(yearMatch[1]) : null;
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
      if (result) rows.push({ formulaStr, result, cell, citation, year: citationYear(citation) });
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
  // param via App.jsx/LandingPage.jsx. When present, real citation rows are
  // fetched from RRUFF's own cellparams scripts (see cellparamsLoader.js);
  // otherwise this page falls back to the hardcoded Abellaite placeholder.
  // `undefined` = not resolved yet; `null` = resolved, mineralId has no
  // cellparams records; an object = resolved with data. Both `null` and
  // "not yet fetched" used to share the same falsy state, so isLoading
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

  // No fallback to CANONICAL_NAME (Abellaite) when mineralId is set and
  // nothing came back for it — that would silently mislabel whatever
  // mineral was actually requested as Abellaite. `name` stays undefined in
  // that case; harmless, since it's only used to build rows (empty either
  // way) and as SummaryView's title, which never renders when there are no
  // rows to show.
  const name = mineralId ? fetched?.mineralName : CANONICAL_NAME;
  const citations = mineralId
    ? fetched?.citations || []
    : EMPIRICAL_CITATIONS_BY_MINERAL[CANONICAL_NAME] || [];

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
              formulaStr={mineralId ? rows[0].formulaStr : CANONICAL_FORMULA}
              rows={rows}
              onSelect={setOpenRowIndex}
            />
          )
        )}
      </div>
    </div>
  );
}
