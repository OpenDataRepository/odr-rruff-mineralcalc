// Shared theme tokens and helpers used across the main parser view,
// the detailed breakdown view, and the summary comparison view.

export const COLORS = {
  bg: "#ffffff",
  panel: "#f2f6f9",
  panelAlt: "#e3edf3",
  border: "#c5d6e0",
  text: "#16334d",
  textDim: "#77a8ca",
  accent: "#0088d1",
  accentSoft: "#d6e6ee",
  warn: "#c9672b",
  mono: "'JetBrains Mono', 'Menlo', 'Consolas', monospace",
};

export const tdStyle = {
  padding: "8px 14px",
  textAlign: "center",
  fontFamily: COLORS.mono,
  borderBottom: `1px solid ${COLORS.border}`,
};

export const backButtonStyle = {
  background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
};

// The formula to show right next to a mineral's name. A "modified ideal
// formula" result (multiple comma-separated site-sharing groups, collapsed
// to a leftmost-element stand-in for the calculation — see expandCommaGroup
// in MineralFormulaParser.jsx) still had the user's actual typed formula
// stashed as originalFormulaStr; that's the real formula and is what
// belongs next to the name, not the collapsed one used to compute the
// breakdown.
export function displayFormulaStr(result) {
  return result.isModifiedIdeal && result.originalFormulaStr ? result.originalFormulaStr : result.formulaStr;
}

// Collapses a formula string's '^2+^' / '_2_' notation down to plain text
// for non-React output (e.g. the .txt report) — valence superscripts are
// dropped entirely and subscript digits are kept but unwrapped, e.g.
// "Pb^2+^_2_(CO_3_)_2_(OH)" -> "Pb2(CO3)2(OH)".
export function plainFormulaString(str) {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === "^" || c === "_") {
      const end = str.indexOf(c, i + 1);
      if (end === -1) {
        out += str.slice(i);
        break;
      }
      if (c === "_") out += str.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Renders a formula string's '^2+^' / '_2_' notation as real <sup>/<sub>
// elements, e.g. "Pb^2+^_2_" -> Pb, <sup>2+</sup>, <sub>2</sub>.
export function renderFormula(str) {
  const nodes = [];
  let buf = "";
  let key = 0;
  const flush = () => {
    if (buf) {
      nodes.push(buf);
      buf = "";
    }
  };
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === "^" || c === "_") {
      const end = str.indexOf(c, i + 1);
      if (end === -1) {
        buf += str.slice(i);
        break;
      }
      flush();
      const raw = str.slice(i + 1, end);
      nodes.push(
        c === "^" ? <sup key={key++}>{raw}</sup> : <sub key={key++}>{raw}</sub>
      );
      i = end + 1;
      continue;
    }
    // The 'box' vacancy-site token — matched the same case-insensitive way
    // parseFormula recognizes it — reads better on screen as the empty-box
    // glyph than as literal text. Purely cosmetic: the underlying formula
    // string this renders from still has the literal word 'box' in it, so
    // batch search (which matches against that raw string, not this output)
    // still finds it by typing "box".
    if (str.slice(i, i + 3).toLowerCase() === "box") {
      buf += "☐";
      i += 3;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return nodes;
}
