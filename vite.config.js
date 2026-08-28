import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The WordPress plugin (wordpress-plugin/odr-rruff-mineralcalc/) enqueues
// whatever it finds at dist/assets/index-*.js|css relative to its own
// plugin directory (see odr-rruff-mineralcalc.php) — building straight into
// that folder means "npm run build" produces exactly what the plugin loads,
// no manual copy step. `base: "./"` keeps every asset URL relative, since
// the plugin can end up installed under any path on any WordPress site.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "wordpress-plugin/odr-rruff-mineralcalc/dist",
    emptyOutDir: true,
  },
});
