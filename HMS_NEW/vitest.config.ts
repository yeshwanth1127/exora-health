import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['db/tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    globalSetup: ['db/tests/global-setup.ts'],
    // DB tests share one database; run files one at a time so they can't interfere.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
