import { auth } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const confirmGroup = document.getElementById("confirmGroup");
const confirmPassword = document.getElementById("confirmPassword");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

let isSignup = false;

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = type;
}

function setMode(signup) {
  isSignup = signup;

  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);

  confirmGroup.hidden = !signup;
  confirmPassword.required = signup;
  document.getElementById("password").autocomplete =
    signup ? "new-password" : "current-password";

  submitBtn.textContent = signup ? "Create Account" : "Log In";
  showMessage("");
}

loginTab.addEventListener("click", () => setMode(false));
signupTab.addEventListener("click", () => setMode(true));

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("index.html");
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmation = confirmPassword.value;

  if (isSignup && password !== confirmation) {
    showMessage("Passwords do not match.");
    return;
  }

  submitBtn.disabled = true;
  showMessage(isSignup ? "Creating your account..." : "Logging in...", "success");

  try {
    if (isSignup) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    showMessage("Success! Opening FocusScribe...", "success");
    window.location.replace("index.html");
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "This email already has an account. Please log in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Choose a stronger password with at least 6 characters.",
      "auth/invalid-credential": "Incorrect email or password. Please try again.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      "auth/too-many-requests": "Too many attempts. Please try again later."
    };

    showMessage(messages[error.code] || `Unable to continue: ${error.message}`);
    submitBtn.disabled = false;
  }
});
