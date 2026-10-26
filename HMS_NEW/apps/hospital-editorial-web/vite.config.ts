import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],server:{host:'127.0.0.1',port:5240,strictPort:true,proxy:{'/public/v1':process.env.HMS_PUBLIC_BOOKING_PROXY||'http://127.0.0.1:3038','/website-config.js':process.env.HMS_PUBLIC_BOOKING_PROXY||'http://127.0.0.1:3038'}},test:{environment:'jsdom',setupFiles:['./src/test/setup.ts'],include:['src/**/*.test.{ts,tsx}']}});
