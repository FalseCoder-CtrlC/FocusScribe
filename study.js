document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("focusScribeCurrentUserId");
    const notesKey = userId ? "focusScribeNotes_" + userId : null;

    const notes = JSON.parse(
        notesKey ? localStorage.getItem(notesKey) || "[]" : "[]"
    );

    const selectedId = localStorage.getItem("selectedStudyNoteId");

    // Sort is not needed: keep the same order as My Notes.
    let currentIndex = notes.findIndex(
        note => String(note.id) === String(selectedId)
    );

    // Handle missing or deleted notes.
    if (currentIndex < 0 && notes.length > 0) {
        currentIndex = 0;
    }

    const timerDisplay = document.getElementById("timerDisplay");
    const timerStatus = document.getElementById("timerStatus");
    const sessionTitle = document.getElementById("sessionTitle");
    const startBtn = document.getElementById("startBtn");
    const resetBtn = document.getElementById("resetBtn");
    const skipBtn = document.getElementById("skipBtn");
    const timerCircle = document.getElementById("timerCircle");

    const noteTitle = document.getElementById("noteTitle");
    const noteContent = document.getElementById("noteContent");
    const noteTag = document.getElementById("noteTag");
    const noteDate = document.getElementById("noteDate");
    const notePosition = document.getElementById("notePosition");

    const previousNoteBtn = document.getElementById("previousNoteBtn");
    const nextNoteBtn = document.getElementById("nextNoteBtn");

    const completedSessionsEl =
        document.getElementById("completedSessions");

    const totalFocusTimeEl =
        document.getElementById("totalFocusTime");

    const sessionModal = document.getElementById("sessionModal");
    const completionTitle =
        document.getElementById("completionTitle");

    const completionMessage =
        document.getElementById("completionMessage");

    const continueBtn = document.getElementById("continueBtn");

    const tabs = document.querySelectorAll(".session-tab");

    const durations = {
        focus: 25 * 60,
        short: 5 * 60,
        long: 15 * 60
    };

    const labels = {
        focus: "Focus Session",
        short: "Short Break",
        long: "Long Break"
    };

    let mode = "focus";
    let remaining = durations[mode];
    let interval = null;
    let running = false;
    let completedSessions = 0;
    let totalFocusSeconds = 0;

    // Progress is kept locally on this device for now.
    try {
        const savedProgress = JSON.parse(
            localStorage.getItem("focusScribeStudyProgress") || "{}"
        );

        completedSessions = Number(savedProgress.completedSessions) || 0;
        totalFocusSeconds = Number(savedProgress.totalFocusSeconds) || 0;
    } catch (error) {
        completedSessions = 0;
        totalFocusSeconds = 0;
    }

    function saveProgress() {
        localStorage.setItem(
            "focusScribeStudyProgress",
            JSON.stringify({
                completedSessions,
                totalFocusSeconds
            })
        );
    }

    function updateProgress() {
        completedSessionsEl.textContent = completedSessions;

        const minutes = Math.floor(totalFocusSeconds / 60);
        totalFocusTimeEl.textContent = `${minutes} min`;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    function updateTimerDisplay() {
        timerDisplay.textContent = formatTime(remaining);

        const total = durations[mode];
        const elapsed = total - remaining;
        const progress = total > 0 ? elapsed / total : 0;

        timerCircle.style.setProperty(
            "--progress",
            `${progress * 360}deg`
        );

        document.title =
            `${formatTime(remaining)} · ${labels[mode]} | FocusScribe`;
    }

    function setMode(newMode) {
        pauseTimer();

        mode = newMode;
        remaining = durations[mode];

        sessionTitle.textContent = labels[mode];

        tabs.forEach(tab => {
            tab.classList.toggle(
                "active",
                tab.dataset.mode === mode
            );
        });

        timerStatus.textContent =
            mode === "focus" ? "Ready to focus" : "Time to relax";

        startBtn.innerHTML = mode === "focus"
            ? '<i class="fas fa-play"></i> Start Focus'
            : '<i class="fas fa-play"></i> Start Break';

        updateTimerDisplay();
    }

    function startTimer() {
        if (running) {
            pauseTimer();
            return;
        }

        if (remaining <= 0) {
            remaining = durations[mode];
        }

        running = true;
        timerStatus.textContent = "Session in progress";

        startBtn.innerHTML =
            '<i class="fas fa-pause"></i> Pause';

        interval = setInterval(() => {
            if (remaining > 0) {
                remaining--;

                if (mode === "focus") {
                    totalFocusSeconds++;
                }

                updateTimerDisplay();
                updateProgress();

                // Save progress occasionally during a focus session.
                if (mode === "focus" && remaining % 10 === 0) {
                    saveProgress();
                }
            }

            if (remaining <= 0) {
                completeSession();
            }
        }, 1000);
    }

    function pauseTimer() {
        if (interval !== null) {
            clearInterval(interval);
            interval = null;
        }

        running = false;

        if (startBtn) {
            startBtn.innerHTML = mode === "focus"
                ? '<i class="fas fa-play"></i> Resume Focus'
                : '<i class="fas fa-play"></i> Resume Break';
        }

        if (timerStatus && remaining > 0) {
            timerStatus.textContent = "Paused";
        }

        saveProgress();
    }

    function resetTimer() {
        pauseTimer();
        remaining = durations[mode];

        timerStatus.textContent = "Timer reset";

        updateTimerDisplay();
    }

    function completeSession() {
        pauseTimer();
        remaining = 0;

        if (mode === "focus") {
            completedSessions++;
            saveProgress();
        }

        updateProgress();
        updateTimerDisplay();

        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("FocusScribe", {
                body: mode === "focus"
                    ? "Focus session complete! Time for a break."
                    : "Break complete! Ready for another session?"
            });
        }

        if (mode === "focus") {
            completionTitle.textContent = "Focus session complete!";
            completionMessage.textContent =
                "Great work! Take a break before your next focus session.";
        } else {
            completionTitle.textContent = "Break finished!";
            completionMessage.textContent =
                "You're refreshed. Continue studying when you're ready.";
        }

        continueBtn.textContent = mode === "focus"
            ? "Start Short Break"
            : "Return to Focus";

        sessionModal.hidden = false;
        timerStatus.textContent = "Session complete";
    }

    function showNote() {
        const note = notes[currentIndex];

        if (!note) {
            noteTitle.textContent = "No notes available";
            noteContent.textContent =
                "Return to My Notes and create a note to begin studying.";

            noteTag.textContent = "No category";
            noteDate.textContent = "";

            notePosition.textContent = "No notes";
            previousNoteBtn.disabled = true;
            nextNoteBtn.disabled = true;

            return;
        }

        noteTitle.textContent = note.title || "Untitled Note";
        noteContent.textContent = note.content || "";
        noteTag.textContent = getTagName(note.tag);

        const dateValue = note.updatedAt || note.date || note.createdAt;

        if (dateValue) {
            const date = new Date(dateValue);

            noteDate.textContent = isNaN(date.getTime())
                ? ""
                : `Last saved: ${date.toLocaleDateString()}`;
        } else {
            noteDate.textContent = "";
        }

        notePosition.textContent =
            `Note ${currentIndex + 1} of ${notes.length}`;

        previousNoteBtn.disabled = currentIndex <= 0;
        nextNoteBtn.disabled = currentIndex >= notes.length - 1;
    }

    function getTagName(tag) {
        const names = {
            work: "Work",
            personal: "Personal",
            ideas: "Ideas",
            reminders: "Reminder"
        };

        return names[tag] || "Note";
    }

    function showNextSession() {
        sessionModal.hidden = true;

        if (mode === "focus") {
            const nextMode = completedSessions % 4 === 0
                ? "long"
                : "short";

            setMode(nextMode);
        } else {
            setMode("focus");
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            setMode(tab.dataset.mode);
        });
    });

    startBtn.addEventListener("click", startTimer);
    resetBtn.addEventListener("click", resetTimer);

    skipBtn.addEventListener("click", () => {
        pauseTimer();
        remaining = 0;
        completeSession();
    });

    previousNoteBtn.addEventListener("click", () => {
        if (currentIndex > 0) {
            currentIndex--;
            localStorage.setItem(
                "selectedStudyNoteId",
                notes[currentIndex].id
            );
            showNote();
        }
    });

    nextNoteBtn.addEventListener("click", () => {
        if (currentIndex < notes.length - 1) {
            currentIndex++;
            localStorage.setItem(
                "selectedStudyNoteId",
                notes[currentIndex].id
            );
            showNote();
        }
    });

    continueBtn.addEventListener("click", showNextSession);

    // Ask permission only after the student interacts with the timer.
    startBtn.addEventListener("click", () => {
        if (
            "Notification" in window &&
            Notification.permission === "default"
        ) {
            Notification.requestPermission();
        }
    });

    window.addEventListener("beforeunload", () => {
        pauseTimer();
        saveProgress();
    });

    showNote();
    updateProgress();
    updateTimerDisplay();
});
