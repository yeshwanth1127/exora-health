import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['db/tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['packages/hospital-web/**', 'apps/staff-web/**', 'apps/sri-lakshmi-web/**', 'apps/hospital-editorial-web/**', 'apps/hospital-community-web/**', '**/node_modules/**'],
    globalSetup: ['db/tests/global-setup.ts'],
    // DB tests share one database; run files one at a time so they can't interfere.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
