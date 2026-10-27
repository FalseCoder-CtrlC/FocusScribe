
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3VOG3B2NxvsjJ0zjqEwpb_gr6MwGIds8",
  authDomain: "focusscribe.firebaseapp.com",
  projectId: "focusscribe",
  storageBucket: "focusscribe.firebasestorage.app",
  messagingSenderId: "670658048904",
  appId: "1:670658048904:web:a2a2ec57b3035426ab003d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
