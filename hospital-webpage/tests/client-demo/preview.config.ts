import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'preview.spec.ts', timeout: 45_000, workers: 1,
  reporter: [['list']], use: { baseURL: 'http://127.0.0.1:5186', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'phone-320', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'webkit-phone', use: { ...devices['iPhone 13'] } },
  ],
});
