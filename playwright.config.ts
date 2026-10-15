import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  use: { baseURL: 'http://127.0.0.1:5173', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: {command: 'npm run dev -- --port 5173', url:'http://127.0.0.1:5173', reuseExistingServer: false, env: {VITE_USE_EMULATORS:'false', VITE_FIREBASE_PROJECT_ID:'', VITE_FIREBASE_API_KEY:'', VITE_FIREBASE_AUTH_DOMAIN:'', VITE_FIREBASE_APP_ID:''}},
});
