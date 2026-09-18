import React, { useState } from "react";
import LandingPage from "./LandingPage.jsx";
import MineralFormulaParser from "./MineralFormulaParser.jsx";

export default function App() {
  // null = show the read-only result page (page 1, which now also shows the
  // empirical/citation comparison table); otherwise the {name, formulaStr}
  // the editor (page 2) should open pre-filled with (whatever was showing on
  // the result page when "Custom Formula" was clicked).
  const [editing, setEditing] = useState(null);

  if (!editing) {
    return <LandingPage onEdit={(name, formulaStr) => setEditing({ name, formulaStr })} />;
  }

  return (
    <MineralFormulaParser
      initialName={editing.name}
      initialFormula={editing.formulaStr}
      onBack={() => setEditing(null)}
    />
  );
}
