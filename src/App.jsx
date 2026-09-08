import React, { useState } from "react";
import LandingPage from "./LandingPage.jsx";
import MineralFormulaParser from "./MineralFormulaParser.jsx";
import EmpiricalFormulasPage from "./EmpiricalFormulasPage.jsx";

export default function App() {
  // null = show the read-only result page (page 1); otherwise the
  // {name, formulaStr} the editor (page 2) should open pre-filled with
  // (whatever was showing on the result page when "Change formula" was
  // clicked).
  const [editing, setEditing] = useState(null);
  // undefined = page 3 not showing; otherwise the RRUFF cellparams outer
  // hash key (from the URL's "ID" param, see LandingPage.jsx) for the
  // mineral page 3 should look up citations for, or null if the landing
  // page had no ID to pass along.
  const [empiricalMineralId, setEmpiricalMineralId] = useState(undefined);

  if (empiricalMineralId !== undefined) {
    return (
      <EmpiricalFormulasPage
        mineralId={empiricalMineralId}
        onBack={() => setEmpiricalMineralId(undefined)}
      />
    );
  }

  if (!editing) {
    return (
      <LandingPage
        onEdit={(name, formulaStr) => setEditing({ name, formulaStr })}
        onViewEmpirical={(mineralId) => setEmpiricalMineralId(mineralId ?? null)}
      />
    );
  }

  return (
    <MineralFormulaParser
      initialName={editing.name}
      initialFormula={editing.formulaStr}
      onBack={() => setEditing(null)}
    />
  );
}
