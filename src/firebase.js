// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  initializeAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  signInWithCredential
} from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export { signInWithCredential };
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDXSMsFqKh2N-TXWRrAX7C434a1Jootx7o",
  authDomain: "landing-page-efde6.firebaseapp.com",
  projectId: "landing-page-efde6",
  storageBucket: "landing-page-efde6.firebasestorage.app",
  messagingSenderId: "69395256863",
  appId: "1:69395256863:web:afc1b1ff2ad68d8f42672a",
  measurementId: "G-XLRFTDCSDJ",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics safely (strictly disabled in extension chrome-extension:// origins to prevent CSP violations)
export let analytics = null;
const isExtensionEnv = typeof window !== 'undefined' && (
  window.location.protocol === 'chrome-extension:' ||
  (typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id))
);

if (!isExtensionEnv) {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch {
        // Ignored
      }
    }
  }).catch(() => {});
}

// Initialize Firebase Authentication with fallback persistence (IndexedDB -> LocalStorage -> Memory)
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore Database with offline persistence
export const db = getFirestore(app);

// Initialize Firebase Storage (used for wallpapers & vault media when bucket is enabled)
export let storage = null;
try {
  storage = getStorage(app);
} catch (err) {
  console.warn("Firebase Storage init note:", err.message || err);
}

// Enable offline persistence safely
enableIndexedDbPersistence(db)
  .then(() => {
    console.log("✅ Firestore offline persistence enabled");
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log("ℹ️ Multiple tabs open, offline persistence shared across sessions.");
    } else {
      console.warn("ℹ️ Offline persistence note:", err.message || err);
    }
  });

