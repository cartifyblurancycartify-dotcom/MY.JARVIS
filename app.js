
"use strict";

const $ = id => document.getElementById(id);
const chat = $("chat");

let recognition = null;
let wakeMode = false;

function setStatus(message) {
  if ($("status")) $("status").textContent = message;
}

function addMessage(message, type = "maya") {
  const element = document.createElement("div");
  element.className = "message " + type;
  element.textContent = message;
  chat.appendChild(element);
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return element;
}

function speak(message) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = "en-IN";
  speech.rate = 1;
  window.speechSynthesis.speak(speech);
}

async function askMaya(message) {
  message = String(message || "").trim();
  if (!message) return;

  addMessage(message, "user");
  if ($("prompt")) $("prompt").value = "";

  const pending = addMessage("Maya is thinking…");
  setStatus("Thinking…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI request failed.");
    }

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The server returned an empty reply.");
    }

    pending.textContent = data.reply;
    speak(data.reply);
  } catch (error) {
    pending.textContent = "Error: " + error.message;
  } finally {
    setStatus("Ready");
  }
}

function openSearch(base, query) {
  window.open(
    base + encodeURIComponent(query),
    "_blank",
    "noopener,noreferrer"
  );
}

function runQuickAction(action) {
  const query = $("prompt")?.value.trim() || "";

  const actions = {
    search: () => openSearch("https://www.google.com/search?q=", query || "latest information"),
    youtube: () => openSearch("https://www.youtube.com/results?search_query=", query || "videos"),
    maps: () => openSearch("https://www.google.com/maps/search/?api=1&query=", query || "nearby places"),
    weather: () => openSearch("https://www.google.com/search?q=", "weather " + (query || "today")),
    news: () => openSearch("https://news.google.com/search?q=", query || "latest news"),
    shopping: () => openSearch("https://www.google.com/search?tbm=shop&q=", query || "products"),
    time: () => addMessage("Current device time: " + new Date().toLocaleString()),
    notes: () => $("notesPanel")?.scrollIntoView({ behavior: "smooth" })
  };

  if (actions[action]) actions[action]();
}

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => runQuickAction(button.dataset.action));
});

$("sendBtn")?.addEventListener("click", () => askMaya($("prompt").value));

$("prompt")?.addEventListener("keydown", event => {
  if (event.key === "Enter") askMaya($("prompt").value);
});

function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $("voiceInfo").textContent =
      "Voice recognition is not supported in this browser. Try a compatible browser.";
    return;
  }

  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = wakeMode;
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("orb")?.classList.add("listening");
    $("voiceInfo").textContent = wakeMode
      ? 'Listening for "Hey Maya" while this page is active.'
      : "Listening. Speak now.";
    setStatus("Listening");
  };

  recognition.onresult = event => {
    const spoken = event.results[event.results.length - 1][0].transcript.trim();

    if (!spoken) return;

    if (wakeMode) {
      if (/hey maya|hi maya|hello maya/i.test(spoken)) {
        const command = spoken
          .replace(/hey maya|hi maya|hello maya/ig, "")
          .trim();

        if (command) {
          wakeMode = false;
          recognition.stop();
          askMaya(command);
        } else {
          $("voiceInfo").textContent =
            "Maya heard you. Tap Talk to Maya to ask your question.";
          speak("Hello. What can I help you with?");
        }
      }
    } else {
      recognition.stop();
      askMaya(spoken);
    }
  };

  recognition.onerror = event => {
    $("voiceInfo").textContent = "Voice error: " + event.error;
    setStatus("Voice unavailable");
  };

  recognition.onend = () => {
    $("orb")?.classList.remove("listening");

    if (wakeMode) {
      setTimeout(() => {
        if (wakeMode) startVoice();
      }, 800);
    } else {
      setStatus("Ready");
    }
  };

  try {
    recognition.start();
  } catch (_) {
    $("voiceInfo").textContent = "Couldn't start the microphone. Please try again.";
  }
}

$("listenBtn")?.addEventListener("click", () => {
  wakeMode = false;
  startVoice();
});

$("wakeBtn")?.addEventListener("click", () => {
  wakeMode = true;
  startVoice();
});

$("stopBtn")?.addEventListener("click", () => {
  wakeMode = false;
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  $("orb")?.classList.remove("listening");
  $("voiceInfo").textContent = "Voice stopped.";
  setStatus("Ready");
});

// Notes are saved in this browser on this device.
const NOTES_KEY = "maya_ai_notes_v1";

function getNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function renderNotes() {
  const list = $("notesList");
  if (!list) return;

  list.replaceChildren();

  getNotes().forEach((note, index) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = note + " ";

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      const notes = getNotes();
      notes.splice(index, 1);
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      renderNotes();
    });

    item.append(text, remove);
    list.appendChild(item);
  });
}

$("saveNoteBtn")?.addEventListener("click", () => {
  const input = $("noteInput");
  const note = input.value.trim();
  if (!note) return;

  const notes = getNotes();
  notes.push(note);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  input.value = "";
  renderNotes();
});

$("clearNotesBtn")?.addEventListener("click", () => {
  if (confirm("Delete all saved notes?")) {
    localStorage.removeItem(NOTES_KEY);
    renderNotes();
  }
});

// Browser timer only; it is not an Android background alarm.
$("reminderBtn")?.addEventListener("click", () => {
  const message = $("reminderText").value.trim();
  const minutes = Number($("reminderMinutes").value);

  if (!message || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    $("reminderStatus").textContent =
      "Enter a message and a time between 1 and 1440 minutes.";
    return;
  }

  $("reminderStatus").textContent =
    "Reminder set. Keep this page open.";

  setTimeout(() => {
    const reminder = "Reminder: " + message;
    addMessage(reminder);
    speak(reminder);
    alert(reminder);
  }, minutes * 60 * 1000);
});

renderNotes();
