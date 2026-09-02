// Ported from ODR's odr_chemistry_plugin.js (RRUFF/ODR mineral database
// project) so plain, unformatted formulas — e.g. "Ni2+C31H32N4" — can be
// converted into this app's "_subscript_" / "^superscript^" syntax instead
// of requiring users to type the delimiters by hand. The original file also
// had jQuery-driven dialog wiring (ODR_runChemistryDialog,
// ODR_hasDuplicatedDelimiters) built around a specific popup widget that
// doesn't exist here — only the pure string-transform functions are needed,
// so those two are left out.

/**
 * Takes a "plain" chemical formula...i.e. "Ni2+C31H32N4"...and attempts to convert it into a
 * formatted state...i.e. "Ni^2+^C_31_H_32_N_4_".  If the formula is already formatted, then this
 * will not return a sensible result.
 *
 * @param {string} input
 * @param {string} [subscript_delimiter]
 * @param {string} [superscript_delimiter]
 * @returns {string}
 */
export function parseChemicalFormula(input, subscript_delimiter = "_", superscript_delimiter = "^") {
  let output = "";
  let chars = [];

  // If the input has '<sub>' or '<sup>' HTML tags already, then suggest replacing them with the
  //  provided sub/superscript delimiters
  input = input
    .replaceAll("<sub>", subscript_delimiter)
    .replaceAll("</sub>", subscript_delimiter)
    .replaceAll("<sup>", superscript_delimiter)
    .replaceAll("</sup>", superscript_delimiter)
    .replaceAll("&nbsp;", " ");

  let len = input.length;
  for (let i = 0; i < len; i++) {
    chars[i] = input.charAt(i);
  }

  for (let i = 0; i < len; i++) {
    let char = chars[i];
    let is_numeric = false;
    if (char >= "0" && char <= "9") is_numeric = true;

    if (is_numeric || char === "x" || char === "Σ") {
      // If this char is a number...
      let prev_char = "";
      if (i - 1 >= 0) prev_char = chars[i - 1];
      let next_char = "";
      if (i + 1 < len) next_char = chars[i + 1];
      let next_next_char = "";
      if (i + 2 < len) next_next_char = chars[i + 2];

      if (prev_char === "(" || prev_char === "[") {
        // ...due to being preceeded by an opening parenthesis or bracket, this is
        //  likely the start of some stupid math formula e.g. (x ≈ 1/7) or (2 < x < 4)
        let sequence = char;
        do {
          // Want to find the closing parenthesis or bracket
          // Note that it's not trying to match a '(' with a ')'...a properly formatted
          //  formula shouldn't have an unclosed '(' or '[' sequence
          if (next_char !== ")" && next_char !== "]") {
            sequence += next_char;
            i++;

            // Don't go past the end of the string
            if (i + 1 < len) next_char = chars[i + 1];
            else break;
          } else {
            break;
          }
        } while (i < len);

        // Done with this sequence, append to the output
        output += sequence;
      } else if ((next_char === "+" || next_char === "-") && next_next_char !== "x") {
        // ...due to a '+' or '-' character that's not followed by an 'x', it's most
        //  likely a valence state  e.g.  Abelsonite: "Ni2+C31H32N4" => "Ni^2+^..."
        if (prev_char === superscript_delimiter && next_next_char === superscript_delimiter) {
          // It looks like this sequence is already wrapped with delimiters...don't
          //  duplicate them
          output += char + next_char + superscript_delimiter;
          i += 2; // skip ahead to the character after the closing superscript
        } else {
          // Wrap the sequence in delimiters
          output += superscript_delimiter + char + next_char + superscript_delimiter;
          i++;
        }
      } else {
        // ...otherwise, it's likely a numerical sequence of some sort
        let sequence = char;
        do {
          let next_char_is_numeric = false;
          if (next_char >= "0" && next_char <= "9") next_char_is_numeric = true;

          if (
            next_char_is_numeric ||
            next_char === "." ||
            next_char === "x" ||
            next_char === "-" ||
            next_char === "+" ||
            next_char === "=" ||
            next_char === "/"
          ) {
            sequence += next_char;
            i++;

            // Don't go past the end of the string
            if (i + 1 < len) next_char = chars[i + 1];
            else break;
          } else {
            break;
          }
        } while (i < len);

        // Done with this sequence, append to the output
        if (prev_char === subscript_delimiter && next_char === subscript_delimiter) {
          // It looks like this sequence is already wrapped with delimiters...don't
          //  dulicate them
          output += sequence + subscript_delimiter;
          i++; // skip over the closing subscript delimiter
        } else if (
          char === "x" &&
          i >= 3 &&
          chars[i - 3] === "[" &&
          chars[i - 2] === "b" &&
          chars[i - 1] === "o" &&
          next_char === "]"
        ) {
          // This triggered on the 'x' inside an existing '[box]' sequence...don't
          //  interrupt with delimiters
          output += sequence + "]";
          i++;
        } else {
          // Wrap the sequence in delimiters
          output += subscript_delimiter + sequence + subscript_delimiter;
        }
      }
    } else if (char === "·" || char === "⋅" || char === "•") {
      // U+00B7 "·" (MIDDLE DOT)
      // U+22C5 "⋅" (DOT OPERATOR)
      // U+2022 "•" (BULLET)
      // The first one is preferred, so convert the others into the first
      if (char === "⋅" || char === "•") char = "·";

      // This character is typically used to denote a collection of water molecules at the
      //  end of the formula...e.g. Abernathyite: "K(UO2)(AsO4)·3H2O"
      let next_char = "";
      if (i + 1 < len) next_char = chars[i + 1];

      let sequence = char;
      do {
        // Need to find the next non-numeric character, to prevent subscripts from being
        //  added around any subsequent number... i.e. don't want "·_3_H2O"
        let next_char_is_numeric = false;
        if (next_char >= "0" && next_char <= "9") next_char_is_numeric = true;

        if (next_char_is_numeric || next_char === "." || next_char === "-" || next_char === "x") {
          sequence += next_char;
          i++;

          // Don't go past the end of the string
          if (i + 1 < len) next_char = chars[i + 1];
          else break;
        } else {
          break;
        }
      } while (i < len);

      // Done with this sequence, append to the output
      output += sequence;
    } else if (char === "□" || char === "▢" || char === "◻" || char === "☐") {
      // U+25A1 "□" (WHITE SQUARE)
      // U+25A2 "▢" (WHITE SQUARE WITH ROUNDED CORNERS)
      // U+25FB "◻" (WHITE MEDIUM SQUARE)
      // U+2610 "☐" (BALLOT BOX)

      // Replace any instance of these characters with 'box', to keep unicode out of the "plain"
      //  formula it at all possible
      output += "[box]";
    } else if (char === " ") {
      // A stray space is far more likely to be copy/paste noise (extra
      // whitespace, a wrapped line) than an intentional vacancy-site marker,
      // so drop it and merge the characters on either side together. A real
      // vacancy site should be typed as one of the □/▢/◻/☐ glyphs (handled
      // above), which converts to "[box]" unambiguously — no guessing needed.
      let next_char = "";
      if (i + 1 < len) next_char = chars[i + 1];

      // Keep the space when it's separating a group before a parenthesis or
      // bracket — that's legitimate formatting, not noise to strip.
      if (next_char === "(" || next_char === "[") {
        output += " " + next_char;
        i++;
      }
      // Otherwise just drop this space — each character in a run of
      // consecutive spaces hits this branch on its own and is dropped the
      // same way, so nothing extra is needed to skip the whole run.
    } else {
      // Otherwise, just echo the character
      output += char;
    }
  }

  return output;
}

/**
 * Returns false if the value does not appear to be a "formatted" chemical formula...i.e. it has
 * a number, but no format characters.
 *
 * @param {string} formula
 * @param {string} [subscript_delimiter]
 * @param {string} [superscript_delimiter]
 * @returns {boolean}
 */
export function isFormulaFormatted(formula, subscript_delimiter = "_", superscript_delimiter = "^") {
  let has_number = false;
  let has_format_char = false;
  for (let i = 0; i < formula.length; i++) {
    let char = formula.charAt(i);
    if (char === subscript_delimiter || char === superscript_delimiter) has_format_char = true;
    if (char >= "0" && char <= "9") has_number = true;
    if (has_format_char && has_number) break;
  }

  // The value is definitely not formatted if it has a number, but no formatting characters
  if (has_number && !has_format_char) return false;

  // Otherwise, assume it's formatted
  return true;
}
