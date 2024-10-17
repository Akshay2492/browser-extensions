const recordButton = document.getElementById('record');
const stopButton = document.getElementById('stop');
const saveButton = document.getElementById('save');
const noteText = document.getElementById('noteText');
const noteTitle = document.getElementById('noteTitle');

let recognition;
let finalTranscript = '';
let editingIndex = null;

// Load saved state
chrome.storage.local.get(['currentNote', 'currentTitle', 'editingIndex'], (data) => {
    if (data.currentNote) {
        noteText.value = data.currentNote;
        saveButton.disabled = false;
    }
    if (data.currentTitle) {
        noteTitle.value = data.currentTitle;
    }
    if (data.editingIndex !== undefined) {
        editingIndex = data.editingIndex;
    }
});

recordButton.addEventListener('click', () => {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.start();

    recordButton.disabled = true;
    stopButton.disabled = false;
    noteText.value = '';

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        noteText.value = finalTranscript + interimTranscript;
        noteText.scrollTop = noteText.scrollHeight; // Auto-scroll
        saveButton.disabled = false;
        saveCurrentState();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        resetButtons();
    };
});

stopButton.addEventListener('click', () => {
    if (recognition) {
        recognition.stop();
        resetButtons();
    }
});

saveButton.addEventListener('click', () => {
    saveNote();
});

function saveNote() {
    const title = noteTitle.value.trim() || 'title-missing';
    const timestamp = getDefaultTimestamp();
    const note = noteText.value.trim();
    if (note) {
        chrome.storage.local.get('notes', (data) => {
            const notes = data.notes || [];
            if (editingIndex !== null) {
                notes.splice(editingIndex, 0, { title: `${title} (${timestamp})`, note });
                editingIndex = null;
            } else {
                notes.unshift({ title: `${title} (${timestamp})`, note });
            }
            chrome.storage.local.set({ notes }, () => {
                displayNotes(notes);
                clearInputs(); // Clear inputs immediately after saving
                saveButton.disabled = true;
                finalTranscript = '';
                clearCurrentState();
            });
        });
    }
}

function clearInputs() {
    noteText.value = '';
    noteTitle.value = '';
}

function getDefaultTimestamp() {
    const now = new Date();
    return now.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function resetButtons() {
    recordButton.disabled = false;
    stopButton.disabled = true;
}

function displayNotes(notes) {
    const notesList = document.getElementById('notesList');
    notesList.innerHTML = '';
    notes.forEach(({ title, note }, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="expand">&#9654;</span> 
            <strong class="note-title">${title}</strong>
            <span class="edit-icon">&#9998;</span>
            <div class="note-content" style="display:none;">${note}</div>
        `;
        li.classList.add('note-item');
        notesList.appendChild(li);

        li.querySelector('.edit-icon').addEventListener('click', () => {
            noteTitle.value = title.split(' (')[0];
            noteText.value = note;
            saveButton.disabled = false;
            editingIndex = index;
            notes.splice(index, 1);
            chrome.storage.local.set({ notes });
            saveCurrentState();
        });
    });

    document.querySelectorAll('.expand').forEach(button => {
        button.addEventListener('click', (e) => {
            const content = e.target.nextElementSibling.nextElementSibling.nextElementSibling;
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            e.target.innerHTML = isVisible ? '&#9654;' : '&#9660;';
        });
    });

    document.querySelectorAll('.note-title').forEach(title => {
        title.addEventListener('mouseenter', (e) => {
            const notePopup = document.createElement('div');
            notePopup.className = 'note-popup';
            notePopup.textContent = e.target.nextElementSibling.nextElementSibling.textContent;
            document.body.appendChild(notePopup);

            const rect = e.target.getBoundingClientRect();
            notePopup.style.position = 'fixed';
            notePopup.style.top = `${rect.bottom + 5}px`;
            notePopup.style.left = `${rect.right + 5}px`;
        });

        title.addEventListener('mouseleave', () => {
            document.querySelectorAll('.note-popup').forEach(popup => popup.remove());
        });
    });
}

function saveCurrentState() {
    chrome.storage.local.set({
        currentNote: noteText.value,
        currentTitle: noteTitle.value,
        editingIndex: editingIndex
    });
}

function clearCurrentState() {
    chrome.storage.local.remove(['currentNote', 'currentTitle', 'editingIndex']);
}

// Call saveCurrentState whenever the note or title changes
noteText.addEventListener('input', saveCurrentState);
noteTitle.addEventListener('input', saveCurrentState);

chrome.storage.local.get('notes', (data) => {
    displayNotes(data.notes || []);
});
