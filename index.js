import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


document.addEventListener("DOMContentLoaded", () => {

  const $ = (id) => document.getElementById(id);

  const drawer = $("drawer");
  const overlay = $("drawerOverlay");
  const menuBtn = $("menuBtn");

  const directoryView = $("directoryView");
  const myNotesView = $("myNotesView");
  const accountView = $("accountView");

  const pageTitle = $("pageTitle");
  const userGrid = $("userGrid");
  const notesContainer = $("notesContainer");
  const sharedNotesContainer = $("sharedNotesContainer");

  const noteModal = $("noteModal");
  const deleteModal = $("deleteModal");
  const sharedNoteModal = $("sharedNoteModal");

  let currentUser = null;
  let myNotes = [];
  let selectedAccount = null;
  let selectedSharedNotes = [];
  let editingId = null;
  let deletingId = null;
  let toastTimer;


  // HELPERS

  const userProfileRef = (uid) => doc(db, "users", uid);

  const notesRef = (uid) => collection(db, "users", uid, "notes");

  const initials = (value = "U") =>
    value.trim().split(/\s+/).slice(0, 2)
      .map(x => x[0] || "")
      .join("").toUpperCase() || "U";

  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const dateLabel = (value) => {
    try {
      const d = value?.toDate
        ? value.toDate()
        : new Date(value || Date.now());

      return Number.isNaN(d.getTime())
        ? "Recently"
        : d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
    } catch {
      return "Recently";
    }
  };

  function timestamp(value) {
    if (value?.toMillis) return value.toMillis();

    const n = new Date(value || 0).getTime();

    return Number.isFinite(n) ? n : 0;
  }

  function toast(message) {
    const el = $("toast");

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }


  // MOBILE DRAWER

  function openDrawer() {
    drawer.classList.add("open");
    overlay.classList.add("show");
    menuBtn?.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.classList.remove("show");
    menuBtn?.setAttribute("aria-expanded", "false");
  }

  menuBtn.addEventListener("click", () =>
    drawer.classList.contains("open")
      ? closeDrawer()
      : openDrawer()
  );

  overlay.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
  });


  // NAVIGATION

  function showView(name) {

    directoryView.classList.toggle("active", name === "directory");
    myNotesView.classList.toggle("active", name === "my-notes");
    accountView.classList.toggle("active", name === "account");

    document.querySelectorAll("[data-view]").forEach(b => {
      b.classList.toggle("active", b.dataset.view === name);
    });

    pageTitle.textContent =
      name === "directory"
        ? "User directory"
        : name === "my-notes"
          ? "My notes"
          : "Shared notes";

    closeDrawer();
  }

  document.querySelectorAll("[data-view]").forEach(btn => {

    btn.addEventListener("click", () => {

      showView(btn.dataset.view);

      if (btn.dataset.view === "my-notes") {
        renderMyNotes();
      }

    });

  });

  $("backToDirectory").addEventListener("click", () => {
    showView("directory");
  });


  // LOGOUT

  $("logoutBtn").addEventListener("click", async () => {

    try {

      await signOut(auth);

      localStorage.removeItem("focusScribeCurrentUserId");
      localStorage.removeItem("selectedStudyNoteId");

      window.location.replace("login.html");

    } catch (e) {

      toast("Couldn't log out: " + e.message);

    }

  });


  // PROFILE

  async function ensureProfile(user) {

    const ref = userProfileRef(user.uid);
    const snap = await getDoc(ref);

    const fallback =
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "FocusScribe user");

    if (!snap.exists()) {

      await setDoc(ref, {
        displayName: fallback,
        createdAt: serverTimestamp()
      });

    } else if (!snap.data().displayName) {

      await setDoc(ref, {
        displayName: fallback
      }, {
        merge: true
      });

    }

    const profile = (await getDoc(ref)).data() || {};

    const displayName = profile.displayName || fallback;

    $("currentUserName").textContent = displayName;
    $("currentUserEmail").textContent = user.email || "Signed in";

    $("currentAvatar").textContent = initials(displayName);
    $("topAvatar").textContent = initials(displayName);

  }


  // MY NOTES CACHE

  function cacheMyNotes() {

    if (!currentUser) return;

    localStorage.setItem(
      "focusScribeCurrentUserId",
      currentUser.uid
    );

    localStorage.setItem(
      "focusScribeNotes_" + currentUser.uid,
      JSON.stringify(myNotes)
    );

  }


  // LOAD MY NOTES

  async function loadMyNotes() {

    const snap = await getDocs(notesRef(currentUser.uid));

    myNotes = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    myNotes.sort((a, b) =>
      timestamp(b.updatedAt || b.createdAt) -
      timestamp(a.updatedAt || a.createdAt)
    );

    cacheMyNotes();

    renderMyNotes();

  }


  // NOTE CARD

  function noteCard(note, ownerMode = true) {

    const sharing = note.isShared
      ? '<span class="shared-label">Shared</span>'
      : "";

    const actions = ownerMode ? `
      <button class="mini-button"
        data-action="study"
        data-id="${escapeHtml(note.id)}">Study</button>

      <button class="mini-button"
        data-action="edit"
        data-id="${escapeHtml(note.id)}">Edit</button>

      <button class="mini-button danger"
        data-action="delete"
        data-id="${escapeHtml(note.id)}">Delete</button>
    ` : "";

    return `
      <article class="note-card ${ownerMode ? "" : "shared-note-card"}"
        ${ownerMode ? "" : `
          data-action="view-shared"
          data-id="${escapeHtml(note.id)}"
          tabindex="0"
          role="button"
          aria-label="Open shared note ${escapeHtml(note.title || "Untitled note")}"
        `}>

        <div class="note-card-top">
          <h3>${escapeHtml(note.title || "Untitled note")}</h3>

          <span class="category-chip">
            ${escapeHtml(note.tag || "Personal")}
          </span>
        </div>

        <p class="note-content">
          ${escapeHtml(note.content || "")}
        </p>

        <div class="note-card-footer">
          <span class="note-date">
            ${dateLabel(note.updatedAt || note.createdAt)}
          </span>

          ${sharing}
          ${actions}
        </div>

        ${ownerMode ? "" : `
          <small class="shared-view-hint">
            Click to read full note →
          </small>
        `}

      </article>
    `;

  }


  // RENDER MY NOTES

  function renderMyNotes() {

    const term = $("searchInput").value.trim().toLowerCase();
    const tag = $("filterSelect").value;

    const filtered = myNotes.filter(n => {

  const matchesCategory =
    tag === "all" ||
    (tag === "favorites"
      ? n.isFavorite === true
      : n.tag === tag);

  const matchesSearch =
    `${n.title || ""} ${n.content || ""}`
      .toLowerCase()
      .includes(term);

  return matchesCategory && matchesSearch;

});

    notesContainer.innerHTML =
      filtered.map(n => noteCard(n, true)).join("");

    $("notesCount").textContent =
      `${filtered.length} ${filtered.length === 1 ? "note" : "notes"}`;

    $("notesEmpty").classList.toggle(
      "hidden",
      filtered.length !== 0
    );

    notesContainer.classList.toggle(
      "hidden",
      filtered.length === 0
    );

  }

  $("searchInput").addEventListener("input", renderMyNotes);

  $("filterSelect").addEventListener("change", renderMyNotes);


  // CREATE / EDIT MODAL

  $("addNoteBtn").addEventListener("click", () => openNoteModal());

  $("emptyAddBtn").addEventListener("click", () => openNoteModal());

  $("closeModalBtn").addEventListener("click", () => noteModal.close());

  $("cancelModalBtn").addEventListener("click", () => noteModal.close());


  function openNoteModal(note = null) {

    editingId = note?.id || null;

    $("modalTitle").textContent =
      note ? "Edit note" : "Create a note";

    $("saveNoteBtn").textContent =
      note ? "Save changes" : "Save note";

    $("noteTitle").value = note?.title || "";
    $("noteContent").value = note?.content || "";
    $("noteTag").value = note?.tag || "Personal";

    $("noteShared").checked = Boolean(note?.isShared);

    $("formError").textContent = "";

    noteModal.showModal();

    $("noteTitle").focus();

  }


  // SAVE NOTE

  $("noteForm").addEventListener("submit", async e => {

    e.preventDefault();

    if (!currentUser) return;

    const button = $("saveNoteBtn");

    button.disabled = true;
    button.textContent = "Saving…";

    $("formError").textContent = "";

    const now = new Date().toISOString();

    const payload = {

      title: $("noteTitle").value.trim(),

      content: $("noteContent").value.trim(),

      tag: $("noteTag").value,

      isShared: $("noteShared").checked,

      updatedAt: now

    };

    if (!payload.title || !payload.content) {

      $("formError").textContent =
        "Please enter both a title and note content.";

      button.disabled = false;

      button.textContent =
        editingId ? "Save changes" : "Save note";

      return;

    }

    try {

      if (editingId) {

        const old = myNotes.find(n => n.id === editingId);

        await setDoc(
  doc(notesRef(currentUser.uid), editingId),
  {
    ...payload,
    createdAt: old?.createdAt || now,
    isFavorite: Boolean(old?.isFavorite),
    isPinned: Boolean(old?.isPinned)
  }
);

      } else {

        const ref = doc(notesRef(currentUser.uid));

        await setDoc(ref, {
          ...payload,
          createdAt: now
        });

      }

      noteModal.close();

      await loadMyNotes();

      toast(editingId ? "Note updated." : "Note created.");

    } catch (err) {

      $("formError").textContent =
        "Couldn't save note. Check your Firestore rules and connection.";

      console.error(err);

    } finally {

      button.disabled = false;

      button.textContent =
        editingId ? "Save changes" : "Save note";

    }

  });


  // MY NOTE ACTIONS

  notesContainer.addEventListener("click", async e => {

    const button = e.target.closest("button[data-action]");

    if (!button) return;

    const note = myNotes.find(n => n.id === button.dataset.id);

    if (!note) return;
    if (button.dataset.action === "favorite") {

  try {

    const newFavoriteStatus = !note.isFavorite;

    await updateDoc(
      doc(notesRef(currentUser.uid), note.id),
      {
        isFavorite: newFavoriteStatus
      }
    );

    note.isFavorite = newFavoriteStatus;

    cacheMyNotes();
    renderMyNotes();

    toast(
      newFavoriteStatus
        ? "Added to favorites."
        : "Removed from favorites."
    );

  } catch (err) {

    console.error(err);
    toast("Couldn't update favorite status.");

  }

  return;
}
    if (button.dataset.action === "edit") {

      openNoteModal(note);

    }

    if (button.dataset.action === "study") {

      cacheMyNotes();

      localStorage.setItem("selectedStudyNoteId", note.id);

      window.location.href = "study.html";

    }

    if (button.dataset.action === "delete") {

      deletingId = note.id;

      deleteModal.showModal();

    }

  });


  // DELETE NOTE

  $("closeDeleteBtn").addEventListener("click", () => deleteModal.close());

  $("cancelDeleteBtn").addEventListener("click", () => deleteModal.close());

  $("confirmDeleteBtn").addEventListener("click", async () => {

    if (!deletingId || !currentUser) return;

    const btn = $("confirmDeleteBtn");

    btn.disabled = true;
    btn.textContent = "Deleting…";

    try {

      await deleteDoc(
        doc(notesRef(currentUser.uid), deletingId)
      );

      deleteModal.close();

      deletingId = null;

      await loadMyNotes();

      toast("Note deleted.");

    } catch (e) {

      toast("Couldn't delete note. Check Firestore rules.");

      console.error(e);

    } finally {

      btn.disabled = false;
      btn.textContent = "Delete note";

    }

  });


  // USER DIRECTORY

  async function loadDirectory() {

    userGrid.innerHTML =
      '<div class="loading-card">Loading the directory…</div>';

    const snap = await getDocs(collection(db, "users"));

    const profiles = snap.docs
      .map(d => ({
        uid: d.id,
        ...d.data()
      }))
      .filter(p => p.displayName);

    renderDirectory(profiles);

  }


  function renderDirectory(profiles) {

    const term = $("userSearch").value.trim().toLowerCase();

    const filtered = profiles.filter(p =>
      (p.displayName || "").toLowerCase().includes(term)
    );

    $("userCount").textContent =
      `${filtered.length} ${filtered.length === 1 ? "account" : "accounts"}`;

    userGrid.innerHTML = filtered.map(p => `

      <button class="user-card" data-user-id="${escapeHtml(p.uid)}">

        <span class="user-card-avatar">
          ${escapeHtml(initials(p.displayName))}
        </span>

        <span class="user-card-body">
          <strong>${escapeHtml(p.displayName)}</strong>
          <small>View shared notes</small>
        </span>

        <span class="user-card-arrow">›</span>

      </button>

    `).join("");

    $("directoryEmpty").classList.toggle(
      "hidden",
      filtered.length > 0
    );

    userGrid.classList.toggle(
      "hidden",
      filtered.length === 0
    );

  }


  $("userSearch").addEventListener("input", () => {

    loadDirectory().catch(err => {

      console.error(err);

      toast("Couldn't search accounts.");

    });

  });


  // OPEN USER ACCOUNT

  userGrid.addEventListener("click", async e => {

    const card = e.target.closest("[data-user-id]");

    if (!card) return;

    const uid = card.dataset.userId;

    try {

      const snap = await getDoc(userProfileRef(uid));

      if (!snap.exists()) {

        return toast("This account profile is unavailable.");

      }

      selectedAccount = {
        uid,
        ...snap.data()
      };

      $("profileName").textContent =
        selectedAccount.displayName || "FocusScribe user";

      $("profileAvatar").textContent =
        initials(selectedAccount.displayName);

      $("sharedSearch").value = "";
      $("sharedFilter").value = "all";

      showView("account");

      await loadSharedNotes();

    } catch (err) {

      console.error(err);

      toast("Couldn't open this account. Check Firestore rules.");

    }

  });


  // LOAD SHARED NOTES

  async function loadSharedNotes() {

    if (!selectedAccount) return;

    sharedNotesContainer.innerHTML =
      '<div class="loading-card">Loading shared notes…</div>';

    const snap = await getDocs(

      query(
        notesRef(selectedAccount.uid),
        where("isShared", "==", true)
      )

    );

    selectedSharedNotes = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    selectedSharedNotes.sort((a, b) =>

      timestamp(b.updatedAt || b.createdAt) -
      timestamp(a.updatedAt || a.createdAt)

    );

    renderSharedNotes();

  }


  // DISPLAY SHARED NOTES

  function renderSharedNotes() {

    const term = $("sharedSearch").value.trim().toLowerCase();

    const tag = $("sharedFilter").value;

    const filtered = selectedSharedNotes.filter(n =>

      (tag === "all" || n.tag === tag) &&

      (`${n.title || ""} ${n.content || ""}`
        .toLowerCase().includes(term))

    );

    sharedNotesContainer.innerHTML =
      filtered.map(n => noteCard(n, false)).join("");

    $("profileNoteCount").textContent =
      `${selectedSharedNotes.length} shared ${
        selectedSharedNotes.length === 1 ? "note" : "notes"
      }`;

    $("sharedEmpty").classList.toggle(
      "hidden",
      filtered.length > 0
    );

    sharedNotesContainer.classList.toggle(
      "hidden",
      filtered.length === 0
    );

  }


  // FULL SHARED NOTE VIEWER

  function openSharedNote(note) {

    $("sharedNoteTitle").textContent =
      note.title || "Untitled note";

    $("sharedNoteAuthor").textContent =
      "By " + (selectedAccount?.displayName || "FocusScribe user");

    $("sharedNoteCategory").textContent =
      note.tag || "Personal";

    $("sharedNoteDate").textContent =
      dateLabel(note.updatedAt || note.createdAt);

    // textContent displays the entire note safely,
    // preserving line breaks through CSS white-space: pre-wrap.
    $("sharedNoteContent").textContent =
      note.content || "";

    sharedNoteModal.showModal();

  }


  // CLICK SHARED NOTE TO OPEN FULL VIEW

  sharedNotesContainer.addEventListener("click", e => {

    const card = e.target.closest('[data-action="view-shared"]');

    if (!card) return;

    const note = selectedSharedNotes.find(
      n => n.id === card.dataset.id
    );

    if (note) openSharedNote(note);

  });


  // KEYBOARD ACCESS FOR SHARED NOTES

  sharedNotesContainer.addEventListener("keydown", e => {

    if (e.key !== "Enter" && e.key !== " ") return;

    const card = e.target.closest('[data-action="view-shared"]');

    if (!card) return;

    e.preventDefault();

    const note = selectedSharedNotes.find(
      n => n.id === card.dataset.id
    );

    if (note) openSharedNote(note);

  });


  // CLOSE SHARED NOTE VIEWER

  $("closeSharedNoteBtn").addEventListener("click", () => {
    sharedNoteModal.close();
  });

  $("closeSharedNoteFooter").addEventListener("click", () => {
    sharedNoteModal.close();
  });


  $("sharedSearch").addEventListener("input", renderSharedNotes);

  $("sharedFilter").addEventListener("change", renderSharedNotes);


  // FIREBASE AUTHENTICATION

  onAuthStateChanged(auth, async user => {

    if (!user) {

      window.location.replace("login.html");

      return;

    }

    currentUser = user;

    try {

      await ensureProfile(user);

      await loadMyNotes();

      await loadDirectory();

    } catch (err) {

      console.error(err);

      toast("Could not load FocusScribe. Check Firebase config and Firestore rules.");

    }

  });

});
