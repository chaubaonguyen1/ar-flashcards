import { resolve } from "node:path";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

// The camera API needs a secure context, so the dev server runs on HTTPS
// (self-signed) to be reachable from a phone on the same Wi-Fi.
export default defineConfig({
  plugins: [basicSsl()],
  // AR.js declares its own three.js range; two copies of three break rendering.
  resolve: { dedupe: ["three"] },
  server: {
    proxy: { "/api": "http://localhost:3001" },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        cards: resolve(__dirname, "cards.html"),
      },
    },
  },
});
