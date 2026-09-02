import { valenceLabel } from "./DetailedView.jsx";

// Tab characters land at fixed tab-stop widths in a plain text viewer
// (Notepad and the like) — they don't widen to fit each column's actual
// content, so rows with differently-sized values drift out of vertical
// alignment with the header. Padding every cell to its column's own widest
// value with spaces instead keeps the table aligned in any monospace
// viewer, tab settings notwithstanding.
function padCell(text, width, align) {
  const pad = " ".repeat(Math.max(0, width - text.length));
  return align === "left" ? text + pad : pad + text;
}

// Renders one flat (single-composition) analyze() result as the same
// information DetailedView shows on screen — name, formula, formula mass,
// net charge, and the full element/valence/count/mass/% table — as plain,
// space-aligned text.
export function formatDetailText(result) {
  // Native metals (e.g. Cu, Au) aren't ionic — a per-atom valence or a "net
  // charge" is meaningless for them, so both are dropped from the report.
  // See isMetallicFormula in MineralFormulaParser.jsx.
  const showValence = !result.isMetallic;
  const headers = showValence
    ? ["Element", "Valence", "Count", "Atomic mass (g/mol)", "Total mass (g/mol)", "% of mass"]
    : ["Element", "Count", "Atomic mass (g/mol)", "Total mass (g/mol)", "% of mass"];
  const dataRows = result.atoms.map((a) => {
    const row = [
      a.symbol + (a.known === false ? " (unknown)" : ""),
      valenceLabel(a),
      a.count.toFixed(3),
      a.weight ? a.weight.toFixed(3) : "—",
      a.totalMass.toFixed(3),
      a.percent.toFixed(3),
    ];
    return showValence ? row : row.filter((_, col) => col !== 1);
  });
  const totalRow = showValence
    ? ["Total", "", "", "", result.totalMass.toFixed(3), "100.000"]
    : ["Total", "", "", result.totalMass.toFixed(3), "100.000"];
  const colWidths = headers.map((h, col) =>
    Math.max(h.length, ...dataRows.map((r) => r[col].length), totalRow[col].length)
  );
  const formatRow = (row) =>
    row.map((cell, col) => padCell(cell, colWidths[col], col === 0 ? "left" : "right")).join("  ");

  const lines = [];
  lines.push(result.name ? `${result.name}, ${result.formulaStr}` : result.formulaStr);
  lines.push(`Formatted Formula: ${result.formulaStr}`);
  lines.push(`Formula mass: ${result.totalMass.toFixed(3)} g/mol`);
  if (showValence) lines.push(`Net charge: ${result.netCharge.toFixed(3)}`);
  lines.push("");
  lines.push(formatRow(headers));
  for (const row of dataRows) lines.push(formatRow(row));
  lines.push(formatRow(totalRow));
  return lines.join("\n");
}

// Shared by every plain-text export. A leading UTF-8 BOM so Windows text
// viewers (Notepad etc.), which otherwise guess the file's encoding,
// reliably detect UTF-8 instead of falling back to the system ANSI
// codepage — without it, any non-ASCII character (the '—' placeholder for
// an unrecognized element's unknown atomic mass, an accented mineral name
// like 'Achávalite') can render as blank or garbled instead of the actual
// character.
export function downloadTxt(content, filename) {
  const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
