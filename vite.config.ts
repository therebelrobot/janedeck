import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare(), react()],
  resolve: {
    alias: {
      "@/shared": path.resolve(__dirname, "src/shared"),
      "@/client": path.resolve(__dirname, "src/client"),
      "@/server": path.resolve(__dirname, "src/server"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
