import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@cleangraph/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@cleangraph/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
})
