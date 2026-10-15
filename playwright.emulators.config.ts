import { defineConfig } from '@playwright/test';
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxy = proxyUrl ? new URL(proxyUrl) : null;
export default defineConfig({
  testDir:'./tests/e2e',workers:1,
  use:{proxy: proxy ? {server:proxy.origin,username:proxy.username,password:proxy.password,bypass:'127.0.0.1,localhost'} : undefined,baseURL:'http://127.0.0.1:5173',launchOptions:{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']}},
  webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:false,env:{VITE_FIREBASE_BACKEND:'functions',VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-funka',VITE_FIREBASE_API_KEY:'demo-key',VITE_FIREBASE_AUTH_DOMAIN:'localhost',VITE_FIREBASE_APP_ID:'demo-app'}},
});
