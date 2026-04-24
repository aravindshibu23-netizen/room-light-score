const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const ROOM_ID = "main-room";
const STORAGE_KEY = "room-light-score-v1";
const FIREBASE_VERSION = "10.13.2";

const defaultPeople = [
  { id: "person-1", name: "Person 1", color: "#2f6f73" },
  { id: "person-2", name: "Person 2", color: "#b34d5f" },
  { id: "person-3", name: "Person 3", color: "#4d7c43" },
  { id: "person-4", name: "Person 4", color: "#6750a4" }
];

let state = loadLocalState();
let remote = null;
let deferredInstallPrompt = null;

const elements = {
  roomTitle: document.querySelector("#roomTitle"),
  syncStatus: document.querySelector("#syncStatus"),
  installButton: document.querySelector("#installButton"),
  leaderName: document.querySelector("#leaderName"),
  leaderScore: document.querySelector("#leaderScore"),
  punishmentText: document.querySelector("#punishmentText"),
  statusBadge: document.querySelector("#statusBadge"),
  reasonSelect: document.querySelector("#reasonSelect"),
  noteInput: document.querySelector("#noteInput"),
  peopleGrid: document.querySelector("#peopleGrid"),
  scoreList: document.querySelector("#scoreList"),
  undoButton: document.querySelector("#undoButton"),
  exportButton: document.querySelector("#exportButton"),
  resetButton: document.querySelector("#resetButton"),
  exitGrid: document.querySelector("#exitGrid"),
  lastExit: document.querySelector("#lastExit"),
  historyList: document.querySelector("#historyList"),
  settingsForm: document.querySelector("#settingsForm"),
  roomNameInput: document.querySelector("#roomNameInput"),
  punishmentInput: document.querySelector("#punishmentInput"),
  memberFields: document.querySelector("#memberFields")
};

render();
registerEvents();
registerServiceWorker();
connectFirebaseIfConfigured();

function createDefaultState() {
  return {
    version: 1,
    roomName: "Room Light Score",
    punishment: "Cleanup duty",
    people: defaultPeople.map((person) => ({ ...person })),
    events: [],
    departures: [],
    updatedAt: Date.now()
  };
}

function hydrateState(rawState) {
  const fallback = createDefaultState();
  const safeState = rawState && typeof rawState === "object" ? rawState : {};
  const people = Array.isArray(safeState.people) && safeState.people.length
    ? safeState.people.slice(0, 4).map((person, index) => ({
        id: String(person.id || defaultPeople[index]?.id || `person-${index + 1}`),
        name: String(person.name || defaultPeople[index]?.name || `Person ${index + 1}`),
        color: normalizeColor(person.color || defaultPeople[index]?.color || "#2f6f73")
      }))
    : fallback.people;

  while (people.length < 4) {
    people.push({ ...defaultPeople[people.length] });
  }

  return {
    ...fallback,
    ...safeState,
    roomName: String(safeState.roomName || fallback.roomName).slice(0, 36),
    punishment: String(safeState.punishment || fallback.punishment).slice(0, 60),
    people,
    events: Array.isArray(safeState.events) ? safeState.events.slice(-300) : [],
    departures: Array.isArray(safeState.departures) ? safeState.departures.slice(-80) : [],
    updatedAt: Number(safeState.updatedAt || fallback.updatedAt)
  };
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return hydrateState(saved ? JSON.parse(saved) : createDefaultState());
  } catch (error) {
    console.warn("Could not load saved room state.", error);
    return createDefaultState();
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function registerEvents() {
  document.body.addEventListener("click", handlePageClick);
  elements.settingsForm.addEventListener("submit", handleSettingsSubmit);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.classList.remove("hidden");
  });

  window.addEventListener("online", () => setSyncStatus(remote ? "Synced" : "Local only"));
  window.addEventListener("offline", () => setSyncStatus("Offline"));
}

function handlePageClick(event) {
  const scoreButton = event.target.closest("[data-add-score]");
  const exitButton = event.target.closest("[data-mark-exit]");

  if (scoreButton) {
    addScore(scoreButton.dataset.addScore);
    return;
  }

  if (exitButton) {
    markExit(exitButton.dataset.markExit);
    return;
  }

  if (event.target.closest("#undoButton")) {
    undoLastScore();
    return;
  }

  if (event.target.closest("#resetButton")) {
    resetRound();
    return;
  }

  if (event.target.closest("#exportButton")) {
    exportBackup();
    return;
  }

  if (event.target.closest("#installButton")) {
    showInstallPrompt();
  }
}

function getScores(roomState = state) {
  const scoreMap = new Map(roomState.people.map((person) => [person.id, 0]));

  for (const scoreEvent of roomState.events) {
    if (scoreMap.has(scoreEvent.personId)) {
      scoreMap.set(scoreEvent.personId, scoreMap.get(scoreEvent.personId) + Number(scoreEvent.points || 0));
    }
  }

  return roomState.people.map((person) => ({
    ...person,
    score: scoreMap.get(person.id) || 0
  }));
}

function render() {
  const scores = getScores();
  const sortedScores = [...scores].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const topScore = Math.max(0, ...scores.map((person) => person.score));
  const leaders = topScore > 0 ? sortedScores.filter((person) => person.score === topScore) : [];

  document.title = state.roomName;
  elements.roomTitle.textContent = state.roomName;
  elements.leaderName.textContent = leaders.length
    ? leaders.length > 1
      ? `Tie: ${leaders.map((person) => person.name).join(", ")}`
      : leaders[0].name
    : "No points yet";
  elements.leaderScore.textContent = String(topScore);
  elements.punishmentText.textContent = leaders.length ? state.punishment : "No punishment yet";
  elements.statusBadge.textContent = leaders.length ? "Punishment active" : "Clear";

  renderPeopleGrid(scores);
  renderScoreList(sortedScores, topScore);
  renderExitGrid(scores);
  renderHistory();
  renderSettings();
}

function renderPeopleGrid(scores) {
  elements.peopleGrid.innerHTML = scores.map((person) => `
    <button class="person-action" type="button" data-add-score="${escapeHtml(person.id)}" style="--person-color: ${escapeHtml(person.color)}" title="Add one point to ${escapeHtml(person.name)}">
      <span class="person-name">${escapeHtml(person.name)}</span>
      <span class="person-meta">
        <span class="score-count">${person.score} ${person.score === 1 ? "point" : "points"}</span>
        <span class="plus-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
          </svg>
        </span>
      </span>
    </button>
  `).join("");
}

function renderScoreList(sortedScores, topScore) {
  const maxScore = Math.max(1, topScore);

  elements.scoreList.innerHTML = sortedScores.map((person) => {
    const width = Math.max(4, Math.round((person.score / maxScore) * 100));
    const isLeader = person.score > 0 && person.score === topScore;
    return `
      <div class="score-row ${isLeader ? "is-leader" : ""}" style="--person-color: ${escapeHtml(person.color)}; --bar-width: ${width}%">
        <div class="score-name">${escapeHtml(person.name)}</div>
        <div class="score-track" aria-hidden="true"><div class="score-fill"></div></div>
        <div class="score-value">${person.score}</div>
      </div>
    `;
  }).join("");
}

function renderExitGrid(scores) {
  const latestExit = [...state.departures].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
  const latestPerson = latestExit ? state.people.find((person) => person.id === latestExit.personId) : null;

  elements.lastExit.textContent = latestPerson
    ? `${latestPerson.name}, ${formatTime(latestExit.createdAt)}`
    : "None";

  elements.exitGrid.innerHTML = scores.map((person) => `
    <button class="exit-action" type="button" data-mark-exit="${escapeHtml(person.id)}" style="--person-color: ${escapeHtml(person.color)}" title="Mark ${escapeHtml(person.name)} out">
      <span class="exit-name">${escapeHtml(person.name)}</span>
      <span class="exit-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </span>
    </button>
  `).join("");
}

function renderHistory() {
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const recentEvents = [...state.events].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).slice(0, 12);

  if (!recentEvents.length) {
    elements.historyList.innerHTML = `<p class="empty-state">No scores recorded.</p>`;
    return;
  }

  elements.historyList.innerHTML = recentEvents.map((scoreEvent) => {
    const person = peopleById.get(scoreEvent.personId) || { name: "Unknown", color: "#617076" };
    const note = scoreEvent.note ? ` - ${escapeHtml(scoreEvent.note)}` : "";
    return `
      <div class="history-item" style="--person-color: ${escapeHtml(person.color)}">
        <span class="history-dot" aria-hidden="true"></span>
        <div class="history-main">
          <p class="history-title">+${Number(scoreEvent.points || 1)} ${escapeHtml(person.name)}</p>
          <p class="history-meta">${escapeHtml(scoreEvent.reason || "Light left on")}${note} · ${formatTime(scoreEvent.createdAt)}</p>
        </div>
      </div>
    `;
  }).join("");
}

function renderSettings() {
  elements.roomNameInput.value = state.roomName;
  elements.punishmentInput.value = state.punishment;
  elements.memberFields.innerHTML = state.people.map((person, index) => `
    <div class="member-field">
      <label class="field">
        <span class="member-label">Color ${index + 1}</span>
        <input type="color" name="color-${escapeHtml(person.id)}" value="${escapeHtml(person.color)}" aria-label="Color for ${escapeHtml(person.name)}">
      </label>
      <label class="field">
        <span class="member-label">Person ${index + 1}</span>
        <input name="name-${escapeHtml(person.id)}" value="${escapeHtml(person.name)}" maxlength="24" autocomplete="off">
      </label>
    </div>
  `).join("");
}

function addScore(personId) {
  const personExists = state.people.some((person) => person.id === personId);
  if (!personExists) return;

  const scoreEvent = {
    id: createId(),
    personId,
    points: 1,
    reason: elements.reasonSelect.value || "Light left on",
    note: elements.noteInput.value.trim().slice(0, 80),
    createdAt: Date.now()
  };

  elements.noteInput.value = "";

  mutateState((draft) => {
    draft.events = [...draft.events, scoreEvent].slice(-300);
    return draft;
  });
}

function markExit(personId) {
  const personExists = state.people.some((person) => person.id === personId);
  if (!personExists) return;

  const exitEvent = {
    id: createId(),
    personId,
    createdAt: Date.now()
  };

  mutateState((draft) => {
    draft.departures = [...draft.departures, exitEvent].slice(-80);
    return draft;
  });
}

function undoLastScore() {
  if (!state.events.length) return;

  mutateState((draft) => {
    const newestEvent = [...draft.events].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
    draft.events = draft.events.filter((scoreEvent) => scoreEvent.id !== newestEvent.id);
    return draft;
  });
}

function resetRound() {
  const confirmed = window.confirm("Reset all scores and recent score history?");
  if (!confirmed) return;

  mutateState((draft) => {
    draft.events = [];
    draft.departures = [];
    return draft;
  });
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.settingsForm);

  mutateState((draft) => {
    draft.roomName = elements.roomNameInput.value.trim().slice(0, 36) || "Room Light Score";
    draft.punishment = elements.punishmentInput.value.trim().slice(0, 60) || "Cleanup duty";
    draft.people = draft.people.map((person) => ({
      ...person,
      name: String(formData.get(`name-${person.id}`) || person.name).trim().slice(0, 24) || person.name,
      color: normalizeColor(formData.get(`color-${person.id}`) || person.color)
    }));
    return draft;
  });
}

async function mutateState(updater) {
  const localDraft = updater(cloneState(state));
  localDraft.updatedAt = Date.now();
  state = hydrateState(localDraft);
  saveLocalState();
  render();

  if (!remote || !navigator.onLine) {
    if (hasFirebaseConfig()) setSyncStatus("Offline");
    return;
  }

  try {
    setSyncStatus("Saving");
    await remote.runTransaction(remote.db, async (transaction) => {
      const snapshot = await transaction.get(remote.roomRef);
      const remoteBase = snapshot.exists() ? hydrateState(snapshot.data()) : hydrateState(state);
      const remoteDraft = updater(cloneState(remoteBase));
      remoteDraft.updatedAt = Date.now();
      transaction.set(remote.roomRef, remoteDraft);
    });
    setSyncStatus("Synced");
  } catch (error) {
    console.warn("Firebase save failed.", error);
    setSyncStatus("Sync error");
  }
}

async function connectFirebaseIfConfigured() {
  if (!hasFirebaseConfig()) {
    setSyncStatus("Local only");
    return;
  }

  try {
    setSyncStatus("Connecting");
    const appModuleUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
    const firestoreModuleUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
    const [{ initializeApp }, firestoreModule] = await Promise.all([
      import(appModuleUrl),
      import(firestoreModuleUrl)
    ]);

    const firebaseApp = initializeApp(FIREBASE_CONFIG);
    const db = firestoreModule.getFirestore(firebaseApp);
    const roomRef = firestoreModule.doc(db, "rooms", ROOM_ID);

    remote = {
      db,
      roomRef,
      runTransaction: firestoreModule.runTransaction
    };

    firestoreModule.onSnapshot(roomRef, async (snapshot) => {
      if (snapshot.exists()) {
        state = hydrateState(snapshot.data());
        saveLocalState();
        render();
        setSyncStatus(navigator.onLine ? "Synced" : "Offline");
        return;
      }

      await firestoreModule.setDoc(roomRef, state);
      setSyncStatus("Synced");
    }, (error) => {
      console.warn("Firebase listener failed.", error);
      setSyncStatus("Sync error");
    });
  } catch (error) {
    console.warn("Firebase setup failed.", error);
    remote = null;
    setSyncStatus("Local only");
  }
}

function hasFirebaseConfig() {
  return Object.values(FIREBASE_CONFIG).every((value) => typeof value === "string" && value.trim().length > 5);
}

function setSyncStatus(label) {
  elements.syncStatus.textContent = label;
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `room-light-score-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function showInstallPrompt() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installButton.classList.add("hidden");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  });
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneState(roomState) {
  return JSON.parse(JSON.stringify(roomState));
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2f6f73";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
