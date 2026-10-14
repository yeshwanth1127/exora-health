import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.HMS_BACKEND_PROXY || "http://127.0.0.1:8000";
  return {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    open: true,
    proxy: {
      ...Object.fromEntries(["/staff", "/api", "/talk", ...(env.VITE_BOOKING_MODE === 'live' ? ["/book"] : [])].map(path => [path, { target: backend, changeOrigin: false }])),
      '/public/v1': { target: env.HMS_PUBLIC_BOOKING_PROXY || 'http://127.0.0.1:3059', changeOrigin: false },
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['omw-website/**', 'cloned_pages/**', 'node_modules/**', 'dist/**'],
  }
  };
});
