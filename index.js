const API_URL = "http://localhost:5000/api";

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

 let notes = JSON.parse(localStorage.getItem("notes")) || [];

// Give existing notes a permanent ID for Study Mode.
let notesChanged = false;

notes.forEach((note) => {
    if (!note.id) {
        note.id = Date.now().toString() +
            Math.random().toString(36).slice(2, 8);

        notesChanged = true;
    }
});

if (notesChanged) {
    localStorage.setItem("notes", JSON.stringify(notes));
}

let noteToDeleteId = null;
let noteToEditId = null;

renderNotes();
updateEmptyState();

addNoteBtn.addEventListener("click", openAddNoteModal);
closeModalBtn.addEventListener("click", closeAddNoteModal);
noteForm.addEventListener("submit", handleNoteSubmit);
searchInput.addEventListener("input", filterNotes);
filterSelect.addEventListener("change", filterNotes);
cancelDeleteBtn.addEventListener("click", closeConfirmModal);
confirmDeleteBtn.addEventListener("click", confirmDeleteNote);

// Render notes
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
                 <button
                 type="button"
                 class="study-btn"
                 data-study-id="${note.id}"
                 title="Study this note"
                >
                <i class="fas fa-book-open"></i>
                Study
                </button>

                <button
                class="edit-btn"
                data-id="${note.id}"
                title="Edit note"
                >
                <i class="fas fa-edit"></i>
                </button>

                <button
                class="delete-btn"
                data-id="${note.id}"
                title="Delete note"
                >
                <i class="fas fa-trash"></i>
                </button>
                </div>
                </div>
                
                <p class="note-text">${escapeHTML(note.content)}</p>

                <div class="note-footer">
                    <span class="note-tag ${getTagClass(note.tag)}">
                        ${getTagIcon(note.tag)}
                        ${getTagName(note.tag)}
                    </span>

                    <span class="note-date">
                        ${formatDate(note.date)}
                    </span>
                </div>
            </div>
        `;

        notesContainer.appendChild(noteElement);
    });

    // Delete buttons
    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            noteToDeleteId = this.getAttribute("data-id");
            openConfirmModal();
        });
    });

    // Edit buttons
    document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            const id = this.getAttribute("data-id");
            openEditNoteModal(id);
        });
    });
    
     // Study buttons
notesContainer.querySelectorAll(".study-btn").forEach((button) => {
    button.addEventListener("click", () => {
        const noteId = button.getAttribute("data-study-id");

        localStorage.setItem("selectedStudyNoteId", noteId);
        window.location.href = "study.html";
    });
});

}


// Prevent HTML injection
function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Get tag CSS class
function getTagClass(tag) {
    const classes = {
        work: "tag-work",
        personal: "tag-personal",
        ideas: "tag-ideas",
        reminders: "tag-reminders",
    };

    return classes[tag] || "";
}

// Get tag icon
function getTagIcon(tag) {
    const icons = {
        work: '<i class="fas fa-briefcase"></i>',
        personal: '<i class="fas fa-user"></i>',
        ideas: '<i class="fas fa-lightbulb"></i>',
        reminders: '<i class="fas fa-bell"></i>',
    };

    return icons[tag] || "";
}

// Get tag name
function getTagName(tag) {
    const names = {
        work: "Work",
        personal: "Personal",
        ideas: "Ideas",
        reminders: "Reminders",
    };

    return names[tag] || tag;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// Open Add/Edit modal
function openAddNoteModal() {
    noteToEditId = null;

    document.querySelector(".modal-title").textContent = "New Note";
    document.querySelector(".submit-btn").textContent = "Save Note";

    noteForm.reset();

    document.querySelector(
        'input[name="noteTag"][value="ideas"]'
    ).checked = true;

    addNoteModal.classList.add("active");
    document.body.style.overflow = "hidden";
}

// Open edit modal
function openEditNoteModal(id) {
    const note = notes.find((note) => note.id === id);

    if (!note) {
        return;
    }

    noteToEditId = id;

    document.querySelector(".modal-title").textContent = "Edit Note";
    document.querySelector(".submit-btn").textContent = "Update Note";

    document.getElementById("noteTitle").value = note.title;
    document.getElementById("noteContent").value = note.content;

    const tagRadio = document.querySelector(
        `input[name="noteTag"][value="${note.tag}"]`
    );

    if (tagRadio) {
        tagRadio.checked = true;
    }

    addNoteModal.classList.add("active");
    document.body.style.overflow = "hidden";
}

// Close Add/Edit modal
function closeAddNoteModal() {
    addNoteModal.classList.remove("active");
    document.body.style.overflow = "auto";

    noteForm.reset();
    noteToEditId = null;

    document.querySelector(".modal-title").textContent = "New Note";
    document.querySelector(".submit-btn").textContent = "Save Note";
}

// Open delete confirmation
function openConfirmModal() {
    confirmModal.classList.add("active");
    document.body.style.overflow = "hidden";
}

// Close delete confirmation
function closeConfirmModal() {
    confirmModal.classList.remove("active");
    document.body.style.overflow = "auto";

    noteToDeleteId = null;
}

// Add or update note
function handleNoteSubmit(e) {
    e.preventDefault();

    const title = document.getElementById("noteTitle").value.trim();
    const content = document.getElementById("noteContent").value.trim();

    const selectedTag = document.querySelector(
        'input[name="noteTag"]:checked'
    );

    if (!selectedTag) {
        return;
    }

    const tag = selectedTag.value;

    // Update existing note
    if (noteToEditId !== null) {
        const noteIndex = notes.findIndex(
            (note) => note.id === noteToEditId
        );

        if (noteIndex !== -1) {
            notes[noteIndex].title = title;
            notes[noteIndex].content = content;
            notes[noteIndex].tag = tag;
            notes[noteIndex].updatedAt = new Date().toISOString();
        }
    }

    // Add new note
    else {
        const newNote = {
            id: Date.now().toString(),
            title: title,
            content: content,
            tag: tag,
            date: new Date().toISOString(),
        };

        notes.unshift(newNote);
    }

    saveNotes();
    closeAddNoteModal();
    filterNotes();
}

// Delete note
function confirmDeleteNote() {
    if (noteToDeleteId !== null) {
        notes = notes.filter(
            (note) => note.id !== noteToDeleteId
        );

        saveNotes();
        closeConfirmModal();
        filterNotes();
    }
}

// Save notes to localStorage
function saveNotes() {
    localStorage.setItem("notes", JSON.stringify(notes));
}

// Search and filter
function filterNotes() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filterValue = filterSelect.value;

    let filteredNotes = [...notes];

    // Search
    if (searchTerm) {
        filteredNotes = filteredNotes.filter(
            (note) =>
                note.title.toLowerCase().includes(searchTerm) ||
                note.content.toLowerCase().includes(searchTerm)
        );
    }

    // Category filter
    if (filterValue !== "all") {
        filteredNotes = filteredNotes.filter(
            (note) => note.tag === filterValue
        );
    }

    renderNotes(filteredNotes);
    updateEmptyState(filteredNotes);
}

// Empty state
function updateEmptyState(notesToCheck = notes) {
    if (notesToCheck.length === 0) {
        emptyState.style.display = "block";
    } else {
        emptyState.style.display = "none";
    }
}

});
