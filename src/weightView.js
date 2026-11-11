import { useSyncExternalStore } from "react";

// Which weight-percent table is showing — "atoms" (elements) or "oxides" —
// shared by every summary and detail view on the page, so picking Oxides in
// one carries over when you open a formula's detail, go back, or switch to
// Custom Formula. A view whose formula has no oxides just shows the element
// table without changing the choice for the others.
let current = "atoms";
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setWeightView(view) {
  if (view === current) return;
  current = view;
  for (const l of listeners) l();
}

export function useWeightView() {
  const view = useSyncExternalStore(subscribe, () => current);
  return [view, setWeightView];
}
