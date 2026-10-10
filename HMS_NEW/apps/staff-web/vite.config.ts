import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.HMS_API_PROXY_TARGET || "http://127.0.0.1:3038";
  return {
    base: "/staff/",
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      minify: "terser",
      terserOptions: { compress: { drop_console: true } },
    },
    server: {
      host: "127.0.0.1",
      port: 5188,
      strictPort: true,
      proxy: Object.fromEntries(
        ["/v1", "/tele/v1", "/dev", "/health", "/ready"].map((prefix) => [
          prefix,
          { target, changeOrigin: true },
        ]),
      ),
    },
  };
});
