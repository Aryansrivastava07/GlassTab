// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore Database with offline persistence
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .then(() => {
    console.log("✅ Firestore offline persistence enabled");
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code === 'unimplemented') {
      console.warn("⚠️ The current browser does not support all of the features required to enable persistence.");
    } else {
      console.error("❌ Error enabling offline persistence:", err);
    }
  });
