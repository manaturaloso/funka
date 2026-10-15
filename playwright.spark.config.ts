import { defineConfig } from '@playwright/test';
import base from './playwright.emulators.config';
export default defineConfig({...base,expect:{timeout:30000},testDir:'./tests/spark-ui',webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:false,env:{VITE_USE_EMULATORS:'true',VITE_FIREBASE_BACKEND:'spark',VITE_FIREBASE_PROJECT_ID:'demo-funka',VITE_FIREBASE_API_KEY:'demo-key',VITE_FIREBASE_AUTH_DOMAIN:'localhost',VITE_FIREBASE_APP_ID:'demo-app'}}});
