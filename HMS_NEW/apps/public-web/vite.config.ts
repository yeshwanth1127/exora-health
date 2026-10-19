import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5191,
    strictPort: true,
    proxy: {
      "/public": "http://127.0.0.1:3038",
      "/sarvam-runtime": "http://127.0.0.1:3038",
    },
  },
});
