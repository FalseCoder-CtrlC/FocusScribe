import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  let notes = [];
  let selectedIndex = 0;
  let duration = 25 * 60;
  let remaining = duration;
  let interval = null;
  let running = false;
  let currentMode = "Focus";
  let currentUser = null;

  const cacheKey = () =>
    "focusScribeNotes_" + (auth.currentUser?.uid || "");

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function format(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function stopTimer() {
    if (interval) clearInterval(interval);

    interval = null;
    running = false;

    $("startBtn").textContent =
      currentMode === "Focus" ? "Start focus" : "Start break";
  }

  function renderTimer() {
    $("timer").textContent = format(remaining);
    document.title = `${format(remaining)} — Study Mode`;
  }

  function renderNote() {
    if (!notes.length) {
      $("noteTitle").textContent = "No notes available";
      $("noteContent").textContent =
        "Create a note in My Notes before starting a study session.";

      $("noteCounter").textContent = "0 / 0";
      $("noteSelect").innerHTML = '<option value="">No notes</option>';

      $("prevNote").disabled = true;
      $("nextNote").disabled = true;

      return;
    }

    const note = notes[selectedIndex];

    $("noteTitle").textContent = note.title || "Untitled note";
    $("noteContent").textContent = note.content || "";
    $("noteCounter").textContent =
      `${selectedIndex + 1} / ${notes.length}`;

    $("noteSelect").value = note.id;

    $("prevNote").disabled = notes.length < 2;
    $("nextNote").disabled = notes.length < 2;
  }

  function selectNote(index) {
    if (!notes.length) return;

    selectedIndex = (index + notes.length) % notes.length;

    localStorage.setItem(
      "selectedStudyNoteId",
      notes[selectedIndex].id
    );

    renderNote();
  }

  function setMode(minutes, label) {
    stopTimer();

    currentMode = label;
    duration = minutes * 60;
    remaining = duration;

    $("timerLabel").textContent = label.toUpperCase();

    $("sessionHint").textContent =
      label === "Focus"
        ? "A focused session is 25 minutes."
        : `Take a ${minutes}-minute ${label.toLowerCase()}.`;

    document.querySelectorAll(".mode-tab").forEach(button => {
      button.classList.toggle(
        "active",
        Number(button.dataset.minutes) === minutes
      );
    });

    renderTimer();

    $("startBtn").textContent =
      label === "Focus" ? "Start focus" : "Start break";
  }

  // SAVE COMPLETED FOCUS SESSION
  async function saveStudySession() {
    if (!currentUser) return;

    const selectedNote = notes[selectedIndex] || null;

    try {
      await addDoc(
        collection(db, "users", currentUser.uid, "studySessions"),
        {
          noteId: selectedNote?.id || null,
          noteTitle: selectedNote?.title || "No note selected",
          durationMinutes: 25,
          completedAt: serverTimestamp()
        }
      );

      await loadStudyHistory();

      $("sessionHint").textContent =
        "Your completed focus session has been saved!";

    } catch (error) {
      console.error("Study history error:", error);

      $("sessionHint").textContent =
        "Session completed, but history could not be saved. Check Firestore rules.";
    }
  }

  function startTimer() {
    if (running) {
      stopTimer();
      return;
    }

    if (remaining <= 0) {
      remaining = duration;
    }

    running = true;
    $("startBtn").textContent = "Pause";

    interval = setInterval(() => {
      remaining--;
      renderTimer();

      if (remaining <= 0) {
        stopTimer();

        remaining = 0;
        renderTimer();

        $("timerLabel").textContent = "SESSION COMPLETE";

        $("sessionHint").textContent =
          "Nice work! Your session is complete.";

        $("startBtn").textContent = "Start again";

        if (
          currentMode === "Focus"
        ) {
          saveStudySession();
        }

        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("FocusScribe", {
            body: "Your timer session is complete."
          });
        }
      }
    }, 1000);
  }

  // STUDY HISTORY
  async function loadStudyHistory() {
    if (!currentUser) return;

    const historyContainer = $("historyContainer");

    historyContainer.innerHTML =
      '<p class="history-empty">Loading study history...</p>';

    try {
      const historyQuery = query(
        collection(db, "users", currentUser.uid, "studySessions"),
        orderBy("completedAt", "desc"),
        limit(10)
      );

      const snapshot = await getDocs(historyQuery);

      if (snapshot.empty) {
        historyContainer.innerHTML =
          '<p class="history-empty">No completed focus sessions yet. Finish your first 25-minute session to see it here.</p>';

        $("historyCount").textContent = "0 sessions";
        return;
      }

      const sessions = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));

      historyContainer.innerHTML = sessions.map(session => {
        const date = session.completedAt?.toDate
          ? session.completedAt.toDate().toLocaleString()
          : "Just completed";

        return `
          <article class="history-item">
            <div class="history-icon">✓</div>
            <div class="history-details">
              <strong>${escapeHtml(session.noteTitle || "No note selected")}</strong>
              <small>${escapeHtml(date)}</small>
            </div>
            <span class="history-duration">
              ${Number(session.durationMinutes) || 25} min
            </span>
          </article>
        `;
      }).join("");

      $("historyCount").textContent =
        `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`;

    } catch (error) {
      console.error("Could not load study history:", error);

      historyContainer.innerHTML =
        '<p class="history-empty">Unable to load study history. Check your Firestore rules.</p>';
    }
  }

  // TIMER BUTTONS
  $("startBtn").addEventListener("click", startTimer);

  $("resetBtn").addEventListener("click", () => {
    stopTimer();
    remaining = duration;
    renderTimer();
  });

  document.querySelectorAll(".mode-tab").forEach(button => {
    button.addEventListener("click", () => {
      setMode(
        Number(button.dataset.minutes),
        button.textContent.trim()
      );
    });
  });

  // NOTE NAVIGATION
  $("prevNote").addEventListener("click", () => {
    selectNote(selectedIndex - 1);
  });

  $("nextNote").addEventListener("click", () => {
    selectNote(selectedIndex + 1);
  });

  $("noteSelect").addEventListener("change", () => {
    const index = notes.findIndex(
      note => note.id === $("noteSelect").value
    );

    if (index >= 0) selectNote(index);
  });

  // FIREBASE AUTHENTICATION
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    currentUser = user;

    try {
      const snapshot = await getDocs(
        collection(db, "users", user.uid, "notes")
      );

      notes = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));

      notes.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return Number(b.isPinned) - Number(a.isPinned);
        }

        return new Date(b.updatedAt || b.createdAt || 0) -
               new Date(a.updatedAt || a.createdAt || 0);
      });

      localStorage.setItem("focusScribeCurrentUserId", user.uid);
      localStorage.setItem(cacheKey(), JSON.stringify(notes));

      $("noteSelect").innerHTML = notes.map(note => `
        <option value="${escapeHtml(note.id)}">
          ${escapeHtml(note.title || "Untitled note")}
        </option>
      `).join("") || '<option value="">No notes</option>';

      const selectedId = localStorage.getItem("selectedStudyNoteId");

      const index = notes.findIndex(note => note.id === selectedId);

      selectedIndex = index >= 0 ? index : 0;

      renderNote();
      renderTimer();

      await loadStudyHistory();

    } catch (error) {
      console.error(error);

      $("noteTitle").textContent = "Unable to load notes";

      $("noteContent").textContent =
        "Check your Firebase configuration and Firestore rules, then reload this page.";
    }
  });
});
