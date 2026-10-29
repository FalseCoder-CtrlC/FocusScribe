
import { auth, db } from "./firebase.js";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function () {
  const notesContainer = document.getElementById("notesContainer");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const addNoteModal = document.getElementById("addNoteModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const noteForm = document.getElementById("noteForm");
  const searchInput = document.getElementById("searchInput");
  const filterSelect = document.getElementById("filterSelect");
  const emptyState = document.getElementById("emptyState");
  const confirmModal = document.getElementById("confirmModal");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  let notes = [];
  let currentUser = null;
  let noteToDeleteId = null;
  let noteToEditId = null;
  let isSaving = false;

  // Keep the old "notes" localStorage data untouched.
  // New notes use a separate, account-specific cache.
  function cacheKey() {
    return `focusScribeNotes_${currentUser.uid}`;
  }

  function getNotesCollection() {
    return collection(db, "users", currentUser.uid, "notes");
  }

  function showError(error) {
    console.error(error);
    alert("Something went wrong while saving or loading your notes. Please check your internet connection and try again.");
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function getTagClass(tag) {
    return {
      work: "tag-work",
      personal: "tag-personal",
      ideas: "tag-ideas",
      reminders: "tag-reminders"
    }[tag] || "";
  }

  function getTagIcon(tag) {
    return {
      work: '<i class="fas fa-briefcase"></i>',
      personal: '<i class="fas fa-user"></i>',
      ideas: '<i class="fas fa-lightbulb"></i>',
      reminders: '<i class="fas fa-bell"></i>'
    }[tag] || "";
  }

  function getTagName(tag) {
    return {
      work: "Work",
      personal: "Personal",
      ideas: "Ideas",
      reminders: "Reminders"
    }[tag] || tag;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderNotes(notesToRender = notes) {
    notesContainer.innerHTML = "";

    notesToRender.forEach((note) => {
      const noteElement = document.createElement("div");
      noteElement.className = "note-card fade-in";

      noteElement.innerHTML = `
        <div class="note-content">
          <div class="note-header">
            <h3 class="note-title">${escapeHTML(note.title)}</h3>
            <div class="note-actions">
              <button type="button" class="study-btn"
                data-study-id="${escapeHTML(note.id)}"
                title="Study this note">
                <i class="fas fa-book-open"></i> Study
              </button>
              <button type="button" class="edit-btn"
                data-id="${escapeHTML(note.id)}" title="Edit note">
                <i class="fas fa-edit"></i>
              </button>
              <button type="button" class="delete-btn"
                data-id="${escapeHTML(note.id)}" title="Delete note">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <p class="note-text">${escapeHTML(note.content)}</p>
          <div class="note-footer">
            <span class="note-tag ${getTagClass(note.tag)}">
              ${getTagIcon(note.tag)} ${escapeHTML(getTagName(note.tag))}
            </span>
            <span class="note-date">${escapeHTML(formatDate(note.date))}</span>
          </div>
        </div>
      `;

      notesContainer.appendChild(noteElement);
    });

    notesContainer.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", () => {
        noteToDeleteId = button.dataset.id;
        openConfirmModal();
      });
    });

    notesContainer.querySelectorAll(".edit-btn").forEach((button) => {
      button.addEventListener("click", () => {
        openEditNoteModal(button.dataset.id);
      });
    });

    notesContainer.querySelectorAll(".study-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const note = notes.find((item) => item.id === button.dataset.studyId);
        if (!note) return;

        localStorage.setItem("focusScribeCurrentUserId", currentUser.uid);
        localStorage.setItem(cacheKey(), JSON.stringify(notes));
        localStorage.setItem("selectedStudyNoteId", note.id);

        window.location.href = "study.html";
      });
    });
  }

  function updateEmptyState(notesToCheck = notes) {
    emptyState.style.display = notesToCheck.length === 0 ? "block" : "none";
  }

  function filterNotes() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filterValue = filterSelect.value;

    const filteredNotes = notes.filter((note) => {
      const matchesSearch =
        String(note.title || "").toLowerCase().includes(searchTerm) ||
        String(note.content || "").toLowerCase().includes(searchTerm);

      const matchesTag =
        filterValue === "all" || note.tag === filterValue;

      return matchesSearch && matchesTag;
    });

    renderNotes(filteredNotes);
    updateEmptyState(filteredNotes);
  }

  async function loadNotes() {
    const snapshot = await getDocs(getNotesCollection());

    notes = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    notes.sort((a, b) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );

    // Separate per-user cache for Study Mode; old "notes" key is not changed.
    localStorage.setItem(cacheKey(), JSON.stringify(notes));
    localStorage.setItem("focusScribeCurrentUserId", currentUser.uid);

    filterNotes();
    updateEmptyState();
  }

  function openAddNoteModal() {
    noteToEditId = null;
    noteForm.reset();

    document.querySelector(".modal-title").textContent = "New Note";
    document.querySelector(".submit-btn").textContent = "Save Note";
    document.querySelector('input[name="noteTag"][value="ideas"]').checked = true;

    addNoteModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function openEditNoteModal(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;

    noteToEditId = id;

    document.querySelector(".modal-title").textContent = "Edit Note";
    document.querySelector(".submit-btn").textContent = "Update Note";
    document.getElementById("noteTitle").value = note.title || "";
    document.getElementById("noteContent").value = note.content || "";

    const tagRadio = document.querySelector(
      `input[name="noteTag"][value="${note.tag}"]`
    );
    if (tagRadio) tagRadio.checked = true;

    addNoteModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeAddNoteModal() {
    addNoteModal.classList.remove("active");
    document.body.style.overflow = "auto";
    noteForm.reset();
    noteToEditId = null;

    document.querySelector(".modal-title").textContent = "New Note";
    document.querySelector(".submit-btn").textContent = "Save Note";
  }

  function openConfirmModal() {
    confirmModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeConfirmModal() {
    confirmModal.classList.remove("active");
    document.body.style.overflow = "auto";
    noteToDeleteId = null;
  }

  async function handleNoteSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    const title = document.getElementById("noteTitle").value.trim();
    const content = document.getElementById("noteContent").value.trim();
    const selectedTag = document.querySelector('input[name="noteTag"]:checked');

    if (!title || !content || !selectedTag) return;

    const now = new Date().toISOString();
    const submitButton = noteForm.querySelector(".submit-btn");

    isSaving = true;
    if (submitButton) submitButton.disabled = true;

    try {
      if (noteToEditId !== null) {
        const existing = notes.find((item) => item.id === noteToEditId);
        if (!existing) return;

        const updatedNote = {
          ...existing,
          title,
          content,
          tag: selectedTag.value,
          updatedAt: now
        };

        await setDoc(doc(getNotesCollection(), noteToEditId), updatedNote);
      } else {
        const noteRef = doc(getNotesCollection());

        const newNote = {
          title,
          content,
          tag: selectedTag.value,
          date: now,
          updatedAt: now
        };

        await setDoc(noteRef, newNote);
      }

      await loadNotes();
      closeAddNoteModal();
    } catch (error) {
      showError(error);
    } finally {
      isSaving = false;
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function confirmDeleteNote() {
    if (!noteToDeleteId || isSaving) return;

    isSaving = true;
    confirmDeleteBtn.disabled = true;

    try {
      await deleteDoc(doc(getNotesCollection(), noteToDeleteId));
      await loadNotes();
      closeConfirmModal();
    } catch (error) {
      showError(error);
    } finally {
      isSaving = false;
      confirmDeleteBtn.disabled = false;
    }
  }

  addNoteBtn.addEventListener("click", openAddNoteModal);
  closeModalBtn.addEventListener("click", closeAddNoteModal);
  noteForm.addEventListener("submit", handleNoteSubmit);
  searchInput.addEventListener("input", filterNotes);
  filterSelect.addEventListener("change", filterNotes);
  cancelDeleteBtn.addEventListener("click", closeConfirmModal);
  confirmDeleteBtn.addEventListener("click", confirmDeleteNote);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    currentUser = user;

    try {
      await loadNotes();
    } catch (error) {
      showError(error);
    }
  });
});
