import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD3VOG3B2NxvsjJ0zjqEwpb_gr6MwGIds8",
  authDomain: "focusscribe.firebaseapp.com",
  projectId: "focusscribe",
  storageBucket: "focusscribe.firebasestorage.app",
  messagingSenderId: "670658048904",
  appId: "1:670658048904:web:a2a2ec57b3035426ab003d",
  measurementId: "G-YLVK4PBNY9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
