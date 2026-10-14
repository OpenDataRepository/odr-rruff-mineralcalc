import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import MetricsPage from "./MetricsPage.jsx";

// The WordPress plugin's two shortcodes share this one bundle and root div:
// [odr-rruff-mineralcalc] is the calculator, [odr-rruff-mineralcalc-metrics]
// adds data-view="metrics" to show the metrics page instead.
const root = document.getElementById("mineral-parser-root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {root.dataset.view === "metrics" ? <MetricsPage /> : <App />}
  </React.StrictMode>
);
