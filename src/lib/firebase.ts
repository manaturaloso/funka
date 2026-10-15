import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
const emulators = import.meta.env.VITE_USE_EMULATORS === 'true';
export const sparkMode = import.meta.env.VITE_FIREBASE_BACKEND === 'spark';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || (emulators ? 'demo-funka' : '');
export const configured = Boolean(projectId && (emulators || (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_APP_ID && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)));
if (emulators && !projectId.startsWith('demo-')) throw new Error('Usa un proyecto demo- para los emuladores.');
const app = configured ? initializeApp({ projectId, apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key', authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost', appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app' }) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app, 'us-central1') : null;
if (emulators && auth && db && functions) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
