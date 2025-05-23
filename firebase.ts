
// firebase.ts

// Importamos desde el CDN oficial de Firebase (módulos ES)
import { initializeApp, type FirebaseApp }      from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth,        type Auth }            from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore,   type Firestore }       from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

// Tu configuración (confirma storageBucket en la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyALtSoePQ35cbZJAKPqZ6LZDKV7-rwDOU4",
  authDomain: "airgi-kanguro.firebaseapp.com",
  projectId: "airgi-kanguro",
  storageBucket: "airgi-kanguro.appspot.com", // Corrected to standard format
  messagingSenderId: "493834717867",
  appId: "1:493834717867:web:cdcd4d1085552fc48f45ee"
};

let appInstance: FirebaseApp | null    = null;
let authInstance: Auth       | null    = null;
let dbInstance: Firestore   | null    = null;
let firebaseInitializationError: string | null = null;

try {
  appInstance  = initializeApp(firebaseConfig);
  authInstance = getAuth(appInstance);
  dbInstance   = getFirestore(appInstance);
  
  if (!appInstance || typeof appInstance.name === 'undefined') {
    throw new Error("initializeApp did not return a valid FirebaseApp instance.");
  }
  if (!authInstance || typeof authInstance.onAuthStateChanged !== 'function') {
    throw new Error("getAuth did not return a valid Auth instance.");
  }
  if (!dbInstance) { // Simplified check: ensure dbInstance is not null/undefined
    const currentProjectId = appInstance?.options?.projectId || firebaseConfig.projectId || "UNKNOWN";
    let errorMessage = `getFirestore returned null or undefined for project ID "${currentProjectId}". `;
    errorMessage += "Please verify Firestore (Native Mode) is enabled in your Firebase project console and project ID is correct.";
    throw new Error(errorMessage);
  }
  console.log("✅ Firebase initialized successfully.");
} catch (e: any) {
  console.error("❌ Error initializing Firebase:", e);
  firebaseInitializationError = e.message || "Unknown error during Firebase initialization.";
  // Ensure instances are null if any part of initialization fails
  appInstance = null;
  authInstance = null;
  dbInstance = null;
}

export { appInstance as app, authInstance as auth, dbInstance as db, firebaseInitializationError };
