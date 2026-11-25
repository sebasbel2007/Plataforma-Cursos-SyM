// File: plataforma cursos SyM/firebase/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpiVJd2c0CDMi35TGaBCXgcKbQ3u81A1o",
  authDomain: "plataforma-de-cursos-3ae42.firebaseapp.com",
  projectId: "plataforma-de-cursos-3ae42",
  storageBucket: "plataforma-de-cursos-3ae42.firebasestorage.app",
  messagingSenderId: "320869816419",
  appId: "1:320869816419:web:55c3e16aa6664c3952c056",
  measurementId: "G-G22KK1GDQP"
};

const app = initializeApp(firebaseConfig);
const analytics = (function(){ try { return getAnalytics(app); } catch(e) { console.warn('[Firebase] Analytics no disponible:', e.message); return null; } })();

export const auth = getAuth(app);
export const db = getFirestore(app);
