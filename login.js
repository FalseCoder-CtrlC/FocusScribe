import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
let mode = "login";
let submitting = false;
function setMode(next) {
  mode = next;
  const signup = mode === "signup";
  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").classList.toggle("active", signup);
  $("displayName").classList.toggle("hidden", !signup);
  $("nameLabel").classList.toggle("hidden", !signup);
  $("displayName").required = signup;
  $("formHeading").textContent = signup ? "Create your account" : "Welcome back";
  $("formSubtitle").textContent = signup ? "Start a fresh, focused workspace." : "Sign in to continue to your workspace.";
  $("submitBtn").textContent = signup ? "Create account" : "Log in";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("authError").textContent = "";
}
$("loginTab").addEventListener("click", () => setMode("login"));
$("signupTab").addEventListener("click", () => setMode("signup"));

onAuthStateChanged(auth, user => {
  // Avoid racing the signup profile write; redirect existing sessions only when the form is idle.
  if (user && !submitting) window.location.replace("index.html");
});

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const button = $("submitBtn");
  submitting = true;
  button.disabled = true;
  button.textContent = mode === "signup" ? "Creating account…" : "Signing in…";
  $("authError").textContent = "";
  const email = $("email").value.trim();
  const password = $("password").value;
  const displayName = $("displayName").value.trim();
  try {
    if (mode === "signup") {
      if (!displayName) throw new Error("Please enter a display name.");
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      await setDoc(doc(db, "users", credential.user.uid), { displayName, createdAt: serverTimestamp() });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    window.location.replace("index.html");
  } catch (err) {
    const messages = {
      "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password": "Use a password with at least 6 characters.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again."
    };
    $("authError").textContent = messages[err.code] || err.message || "Authentication failed.";
  } finally {
    submitting = false;
    button.disabled = false;
    button.textContent = mode === "signup" ? "Create account" : "Log in";
  }
});
