import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  let notes = [], selectedIndex = 0, duration = 25 * 60, remaining = duration, interval = null, running = false;
  const cacheKey = () => "focusScribeNotes_" + (auth.currentUser?.uid || "");
  function format(seconds) { return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`; }
  function stopTimer() { if (interval) clearInterval(interval); interval = null; running = false; $("startBtn").textContent = "Start focus"; }
  function renderTimer() { $("timer").textContent = format(remaining); document.title = `${format(remaining)} — Study Mode`; }
  function renderNote() {
    if (!notes.length) {
      $("noteTitle").textContent = "No notes available"; $("noteContent").textContent = "Create a note in My Notes before starting a study session.";
      $("noteCounter").textContent = "0 / 0"; $("noteSelect").innerHTML = '<option value="">No notes</option>';
      $("prevNote").disabled = true; $("nextNote").disabled = true; return;
    }
    const note = notes[selectedIndex];
    $("noteTitle").textContent = note.title || "Untitled note"; $("noteContent").textContent = note.content || "";
    $("noteCounter").textContent = `${selectedIndex+1} / ${notes.length}`;
    $("noteSelect").value = note.id;
    $("prevNote").disabled = notes.length < 2; $("nextNote").disabled = notes.length < 2;
  }
  function selectNote(index) { if (!notes.length) return; selectedIndex = (index + notes.length) % notes.length; localStorage.setItem("selectedStudyNoteId", notes[selectedIndex].id); renderNote(); }
  function setMode(minutes, label) {
    stopTimer(); duration = minutes * 60; remaining = duration; $("timerLabel").textContent = label.toUpperCase(); $("sessionHint").textContent = label === "Focus" ? "A focused session is 25 minutes." : `Take a ${minutes}-minute ${label.toLowerCase()}.`;
    document.querySelectorAll(".mode-tab").forEach(b => b.classList.toggle("active", Number(b.dataset.minutes) === minutes)); renderTimer();
    $("startBtn").textContent = label === "Focus" ? "Start focus" : "Start break";
  }
  function startTimer() {
    if (running) { stopTimer(); return; }
    running = true; $("startBtn").textContent = "Pause";
    interval = setInterval(() => {
      remaining--; renderTimer();
      if (remaining <= 0) { stopTimer(); remaining = 0; renderTimer(); $("timerLabel").textContent = "SESSION COMPLETE"; $("sessionHint").textContent = "Nice work. Take a breath before your next session."; $("startBtn").textContent = "Start again"; if ("Notification" in window && Notification.permission === "granted") new Notification("FocusScribe", { body: "Your timer session is complete." }); }
    }, 1000);
  }
  $("startBtn").addEventListener("click", startTimer);
  $("resetBtn").addEventListener("click", () => { stopTimer(); remaining = duration; renderTimer(); });
  document.querySelectorAll(".mode-tab").forEach(b => b.addEventListener("click", () => setMode(Number(b.dataset.minutes), b.textContent.trim())));
  $("prevNote").addEventListener("click", () => selectNote(selectedIndex - 1));
  $("nextNote").addEventListener("click", () => selectNote(selectedIndex + 1));
  $("noteSelect").addEventListener("change", () => { const i = notes.findIndex(n => n.id === $("noteSelect").value); if (i >= 0) selectNote(i); });
  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.replace("login.html"); return; }
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "notes"));
      notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notes.sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      // Refresh the account-specific cache for older browser sessions; never read the legacy "notes" key.
      localStorage.setItem("focusScribeCurrentUserId", user.uid);
      localStorage.setItem(cacheKey(), JSON.stringify(notes));
      $("noteSelect").innerHTML = notes.map(n => `<option value="${String(n.id).replace(/"/g,"&quot;")}">${String(n.title || "Untitled note").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</option>`).join("") || '<option value="">No notes</option>';
      const selectedId = localStorage.getItem("selectedStudyNoteId");
      const idx = notes.findIndex(n => n.id === selectedId);
      selectedIndex = idx >= 0 ? idx : 0;
      renderNote(); renderTimer();
    } catch (e) { console.error(e); $("noteTitle").textContent = "Unable to load notes"; $("noteContent").textContent = "Check your Firebase configuration and Firestore rules, then reload this page."; }
  });
});
