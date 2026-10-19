import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { seoTags, siteUrl } from "./scripts/seo.mjs";

const api = "http://localhost:8000";

// Serve the static pages (plain view, privacy) at /plain/ and /privacy/ in dev, like the static host does in production.
const staticPages = () => ({
  name: "static-pages",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? "").split("?")[0];
      for (const page of ["plain", "privacy"]) {
        if (path === `/${page}` || path === `/${page}/`) req.url = `/${page}/index.html`;
      }
      next();
    });
  },
});

// Canonical URL, Open Graph / Twitter cards, JSON-LD and the optional Plausible script, from the profile content.
const seo = () => ({
  name: "seo-tags",
  transformIndexHtml(html) {
    const seed = JSON.parse(readFileSync(new URL("./src/content/seed.json", import.meta.url), "utf8"));
    const tags = seoTags(seed, { site: siteUrl(), plausibleDomain: process.env.VITE_PLAUSIBLE_DOMAIN || "" });
    return html.replace("<!--seo-->", tags);
  },
});

export default defineConfig({
  plugins: [react(), staticPages(), seo()],
  build: {
    rollupOptions: {
      output: {
        // vendor code changes rarely, so it gets its own long-cached files; the page's own code stays small
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) return "motion";
          if (id.includes("@tanstack") || id.includes("zod") || id.includes("zustand")) return "data";
          if (id.includes("@radix-ui") || id.includes("cmdk")) return "ui";
          // the 3D engine behind the one 3D world; only ever loaded in full graphics mode
          if (/node_modules\/(three|@react-three\/fiber)\//.test(id)) return "three";
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": api,
      "/evolve": api,
      "/ws": { target: api, ws: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    globals: true,
    css: false,
  },
});
