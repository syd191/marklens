import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react";
          if (id.includes("node_modules/mermaid")) return "mermaid";
          if (id.includes("node_modules/katex") || id.includes("node_modules/markdown-it") || id.includes("node_modules/highlight.js")) {
            return "markdown";
          }
          if (id.includes("node_modules/lucide-react")) return "icons";
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
