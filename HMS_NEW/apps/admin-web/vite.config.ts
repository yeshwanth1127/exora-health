import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({ base: "/admin/", plugins: [react()], server: { host: "127.0.0.1", port: 5192, strictPort: true, proxy: { "/control": "http://127.0.0.1:3040" } } });
