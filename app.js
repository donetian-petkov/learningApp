import { INITIAL_APP_STATE } from "./seed-data.mjs";
import { decorateIcons, icon, themeArt } from "./icons.js";
import { buildLessonDraft, buildLessonPack, buildLessonProgressChecklist, chooseJapaneseVoice, describeLessonExerciseType, describeRuntimeMode, escapeHtml, filterLessonCatalog, filterModerationActions, findNextLessonId } from "./shared.mjs";

const defaultState = structuredClone(INITIAL_APP_STATE);

let state = structuredClone(defaultState);
let dictionaryLookup = [];
let adminLessonEditor = null;
let adminKanjiEditor = null;
let adminUserEditor = null;
let adminUserDirectory = null;
let adminUserFilters = {
  username: "",
  email: "",
  status: "",
  level: "",
};
let adminAiPlayground = null;
let systemStatus = null;
let listeningScenarioIndex = 0;
let speakingPromptIndex = 0;
let readingSelection = null;
let kanjiSelection = null;
let kanjiStudyIndex = 0;
let kanjiStudyExampleIndex = 0;
let kanjiReviewIndex = 0;
let kanjiReviewFeedback = "";
let lessonExerciseIndex = 0;
let lessonExerciseFeedback = "";
let lessonExerciseDraftAnswer = "";
let lessonExerciseResult = null;
let lessonDialogueIndex = 0;
let lessonSceneIndex = 0;
let roleplayDraft = "";
let reviewDeckIndex = 0;
let reviewReveal = false;
let savedStudyIndex = 0;
let savedStudyReveal = false;
let savedStudyMode = "all";
let savedStudyFeedback = "";
let lessonNoteFeedback = "";
let lessonCatalogQuery = "";
let renderedView = null;
let adminPasswordFeedback = "";
let consumedFields = new Set();
let persistTimer = null;
let persistInFlight = null;
let persistQueued = false;
let lessonCatalogTheme = "";
let lessonStep = "overview";
const LESSON_STEPS = [
  { id: "overview", label: "Overview", icon: "sparkles" },
  { id: "scene", label: "Scene", icon: "tv" },
  { id: "words", label: "Words & kanji", icon: "book" },
  { id: "grammar", label: "Grammar", icon: "lightbulb" },
  { id: "practice", label: "Exercises", icon: "target" },
  { id: "notes", label: "Notes", icon: "pen" },
];
let lessonCatalogDifficulty = "";
let moderationFilters = {
  query: "",
  status: "",
  itemType: "",
  reviewer: "",
};
let permissionDraft = null;

function feedbackTone(message = "") {
  const text = String(message ?? "").trim().toLowerCase();
  if (!text) return "";
  if (text.startsWith("correct") || text.includes("saved") || text.includes("completed")) return "good";
  if (text.startsWith("not quite") || text.startsWith("wrong") || text.includes("failed")) return "bad";
  if (text.startsWith("choose") || text.startsWith("pick")) return "warn";
  return "";
}

function feedbackClass(message = "") {
  const tone = feedbackTone(message);
  return tone ? `feedback feedback-${tone}` : "feedback feedback-neutral";
}

function setFeedbackNode(node, message) {
  if (!node) return;
  node.className = feedbackClass(message);
  node.textContent = message;
}

function savedWordKey(term, reading = "") {
  return `${String(term ?? "").trim()}|${String(reading ?? "").trim()}`;
}

function savedKanjiKey(character) {
  return String(character ?? "").trim();
}

function buildWordBookmark(item, lesson = null) {
  return {
    term: String(item?.word ?? item?.term ?? "").trim(),
    reading: String(item?.kana ?? item?.reading ?? "").trim(),
    meaning: String(item?.meaning ?? "").trim(),
    partOfSpeech: String(item?.partOfSpeech ?? item?.part_of_speech ?? "noun").trim() || "noun",
    example: String(item?.example ?? lesson?.japanese ?? "").trim(),
    source: String(item?.source ?? "lesson").trim() || "lesson",
    sourceLessonId: String(lesson?.id ?? item?.sourceLessonId ?? "").trim(),
    sourceLessonTitle: String(lesson?.title ?? item?.sourceLessonTitle ?? "").trim(),
  };
}

function buildKanjiBookmark(item, lesson = null) {
  return {
    character: String(item?.character ?? item?.kanji ?? "").trim(),
    meaning: String(item?.meaning ?? "").trim(),
    onYomi: String(item?.onYomi ?? item?.on_yomi ?? "").trim(),
    kunYomi: String(item?.kunYomi ?? item?.kun_yomi ?? "").trim(),
    examples: Array.isArray(item?.examples) ? item.examples.filter(Boolean) : lesson?.japanese ? [lesson.japanese] : [],
    source: String(item?.source ?? "kanji").trim() || "kanji",
    sourceLessonId: String(lesson?.id ?? item?.sourceLessonId ?? "").trim(),
    sourceLessonTitle: String(lesson?.title ?? item?.sourceLessonTitle ?? "").trim(),
  };
}

function buildReviewWordBookmark(review) {
  return {
    word: String(review?.prompt ?? "").trim(),
    term: String(review?.prompt ?? "").trim(),
    kana: String(review?.answer ?? "").trim(),
    reading: String(review?.answer ?? "").trim(),
    meaning: String(review?.meaning ?? "").trim(),
    example: String(review?.prompt ?? "").trim(),
    source: "review",
    sourceLessonId: String(review?.source_lesson_id ?? review?.sourceLessonId ?? "").trim(),
    sourceLessonTitle: String(review?.sourceLessonTitle ?? "").trim(),
  };
}

function buildReviewKanjiBookmark(review) {
  return {
    character: String(review?.character ?? "").trim(),
    meaning: String(review?.meaning ?? review?.answer ?? "").trim(),
    onYomi: String(review?.onYomi ?? "").trim(),
    kunYomi: String(review?.kunYomi ?? "").trim(),
    examples: Array.isArray(review?.examples) ? review.examples.filter(Boolean) : [],
    source: "review",
    sourceLessonId: String(review?.source_entry_id ?? "").trim(),
    sourceLessonTitle: "",
  };
}

function buildKanjiEditorDraft(entry = {}) {
  return {
    id: String(entry?.id ?? "").trim(),
    character: String(entry?.character ?? "").trim(),
    meaning: String(entry?.meaning ?? "").trim(),
    onYomi: String(entry?.onYomi ?? "").trim(),
    kunYomi: String(entry?.kunYomi ?? "").trim(),
    examples: Array.isArray(entry?.examples) ? entry.examples : [],
    radicals: Array.isArray(entry?.radicals) ? entry.radicals : [],
    strokeCount: Number(entry?.strokeCount ?? 0) || 0,
    strokeOrderSource: String(entry?.strokeOrderSource ?? "").trim(),
    groupName: String(entry?.groupName ?? entry?.group ?? "").trim(),
    difficulty: String(entry?.difficulty ?? "N5").trim() || "N5",
    relatedKanji: Array.isArray(entry?.relatedKanji) ? entry.relatedKanji : [],
    source: String(entry?.source ?? "manual").trim() || "manual",
  };
}

function parseLineList(value, fallback = []) {
  const text = String(value ?? "").trim();
  if (!text) return Array.isArray(fallback) ? fallback : [];
  return text
    .split(/[\n,、\/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const listeningScenarios = [
  {
    id: "ramen-broth",
    title: "Ramen shop order",
    prompt: "What did the server ask?",
    question: "The server asked whether you want light or rich broth.",
    answerKey: "broth",
    choices: [
      { key: "broth", label: "Ask about broth" },
      { key: "price", label: "Ask about price" },
      { key: "name", label: "Ask your name" },
    ],
  },
  {
    id: "station-direction",
    title: "Station directions",
    prompt: "What did the staff explain?",
    question: "The staff explained how to reach the ticket counter.",
    answerKey: "ticket",
    choices: [
      { key: "ticket", label: "Ticket counter" },
      { key: "exit", label: "Exit gate" },
      { key: "food", label: "Food court" },
    ],
  },
  {
    id: "anime-training",
    title: "Anime training scene",
    prompt: "What was the rival asking?",
    question: "The rival wanted to see your determination.",
    answerKey: "determination",
    choices: [
      { key: "determination", label: "Show determination" },
      { key: "weather", label: "Talk about weather" },
      { key: "homework", label: "Talk about homework" },
    ],
  },
];

const speakingPrompts = [
  {
    id: "ramen-order",
    title: "Ramen order",
    prompt: "Ask for ramen politely.",
    reference: "ラーメンをください。",
  },
  {
    id: "station-help",
    title: "At the station",
    prompt: "Ask where the ticket counter is.",
    reference: "切符売り場はどこですか。",
  },
  {
    id: "study-plan",
    title: "Study plan",
    prompt: "Say you study Japanese every day.",
    reference: "私は毎日日本語を勉強します。",
  },
];

const app = document.querySelector("#app");
const navButtons = document.querySelectorAll(".nav-item");
const toggleButtons = document.querySelectorAll("[data-toggle]");

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    persist();
    render();
  });
});

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.toggle;
    state.toggles[key] = !state.toggles[key];
    persist();
    render();
  });
});

// Keyboard shortcuts for the vocab flashcard on the Review screen: Space reveals
// the answer, 1-4 grade it (Again, Hard, Good, Easy), and the arrow keys move
// between cards. They stay out of the way while you're typing in a field.
document.addEventListener("keydown", (event) => {
  if (state.view !== "review" || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  // A focused button inside the page keeps its own Space/Enter behaviour; the top
  // navigation doesn't, so the shortcuts still work right after opening Review.
  if (app.contains(event.target) && event.target.closest?.("button, a")) return;
  const card = app.querySelector("[data-flashcard]");
  if (!card) return;
  const press = (selector) => {
    const button = card.querySelector(selector);
    if (!button) return false;
    event.preventDefault();
    button.click();
    return true;
  };
  if (event.key === " " || event.key === "Enter") press('[data-action="review-reveal-card"]');
  else if (event.key === "ArrowLeft") press('[data-action="review-prev-card"]');
  else if (event.key === "ArrowRight") press('[data-action="review-next-card"]');
  else if (["1", "2", "3", "4"].includes(event.key)) press(`[data-action="grade-review"][data-grade="${Number(event.key) + 1}"]`);
});

render();
init();

async function init() {
  try {
    state = await loadState();
    systemStatus = await loadSystemStatus();
    render();
  } catch {
    try {
      state = await loadState();
    } catch {
      state = structuredClone(defaultState);
    }
    systemStatus = await loadSystemStatus();
    render();
  }
}

async function loadState() {
  const response = await fetch("/api/state");
  if (!response.ok) throw new Error("Failed to load state");
  return mergeState(defaultState, await response.json());
}

async function loadSystemStatus() {
  try {
    const response = await fetch("/api/system/status");
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function apiJson(path, options = {}) {
  // A waiting state save must reach the server before any call that changes data
  // there, or it would arrive afterwards and overwrite that change.
  if (options.method && options.method !== "GET") await settlePendingSave();
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload;
}

// Saves are batched: rapid clicks produce one request a moment later instead of
// one per click, and only one save is in flight at a time so an older copy of
// the state can never land after a newer one.

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersist, 400);
}

async function flushPersist() {
  clearTimeout(persistTimer);
  persistTimer = null;
  if (persistInFlight) {
    persistQueued = true;
    return;
  }
  persistInFlight = postState();
  await persistInFlight;
  persistInFlight = null;
  if (persistQueued) {
    persistQueued = false;
    flushPersist();
  }
}

function postState(options = {}) {
  return fetch("/api/state", {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(state),
    ...options,
  }).catch(() => {});
}

async function settlePendingSave() {
  if (persistTimer) await flushPersist();
  while (persistInFlight) await persistInFlight;
}

// If the tab is closed or hidden with a save still waiting, send it straight away.
window.addEventListener("pagehide", () => {
  if (!persistTimer && !persistQueued) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  persistQueued = false;
  postState({ keepalive: true });
});

function render() {
  syncHeader();

  const views = {
    learn: renderLearn,
    practice: renderPractice,
    review: renderReview,
    progress: renderProgress,
    settings: renderSettings,
    admin: renderAdmin,
  };

  // Redrawing replaces every element, so remember what the user was in the middle of:
  // unsent text in fields, which field had focus (and where the cursor was), and the
  // scroll position. Switching to another screen starts at the top instead.
  const sameView = renderedView === state.view;
  const drafts = sameView ? captureFieldDrafts() : new Map();
  const focus = sameView ? captureFocusedField() : null;
  const scrollY = window.scrollY;

  app.innerHTML = views[state.view]();
  decorateIcons(app);

  restoreFieldDrafts(drafts);
  restoreFocusedField(focus);
  window.scrollTo(0, sameView ? scrollY : 0);
  renderedView = state.view;
}

// Text typed into a field but not yet used. Fields in the card of the last clicked
// button are left out, because that click is what used (or cleared) their text.
function captureFieldDrafts() {
  const drafts = new Map();
  app.querySelectorAll("input[data-field], textarea[data-field]").forEach((field) => {
    if (field.type === "file" || field.type === "checkbox" || field.type === "radio") return;
    if (consumedFields.has(field.dataset.field) || field.value === field.defaultValue) return;
    drafts.set(field.dataset.field, { value: field.value, renderedValue: field.defaultValue });
  });
  return drafts;
}

function restoreFieldDrafts(drafts) {
  drafts.forEach((draft, name) => {
    const field = app.querySelector(`[data-field="${CSS.escape(name)}"]`);
    // Only put the draft back if the app didn't deliberately change this field.
    if (field && field.defaultValue === draft.renderedValue) field.value = draft.value;
  });
}

function captureFocusedField() {
  const active = document.activeElement;
  if (!active?.dataset?.field || !app.contains(active)) return null;
  return {
    name: active.dataset.field,
    start: typeof active.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

function restoreFocusedField(focus) {
  if (!focus) return;
  const field = app.querySelector(`[data-field="${CSS.escape(focus.name)}"]`);
  if (!field) return;
  field.focus({ preventScroll: true });
  if (focus.start !== null && typeof field.setSelectionRange === "function") {
    try {
      field.setSelectionRange(focus.start, focus.end ?? focus.start);
    } catch {
      // Some input types (number, email) don't support a cursor position.
    }
  }
}

function syncHeader() {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  toggleButtons.forEach((button) => {
    const key = button.dataset.toggle;
    const label = key[0].toUpperCase() + key.slice(1);
    const on = Boolean(state.toggles[key]);
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
    button.title = `${label}: ${on ? "On" : "Off"}`;
    button.querySelector(".toggle-state").textContent = on ? "On" : "Off";
  });
}

function renderLearn() {
  const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
  const kanjiDeck = Array.isArray(state.kanjiEntries) ? state.kanjiEntries : [];
  const completedExercises = new Set(Array.isArray(state.progress.completedExercises) ? state.progress.completedExercises : []);
  const savedWords = new Map((state.progress.savedWords ?? []).map((item) => [savedWordKey(item.term, item.reading), item]));
  const savedKanji = new Map((state.progress.savedKanji ?? []).map((item) => [savedKanjiKey(item.character), item]));
  const selectedKanjiEntry = kanjiSelection
    ?? kanjiDeck.find((entry) => activeLesson.kanji.includes(entry.character))
    ?? kanjiDeck[kanjiStudyIndex % Math.max(kanjiDeck.length, 1)]
    ?? null;
  const selectedStudyEntry = kanjiSelection
    ?? kanjiDeck[kanjiStudyIndex % Math.max(kanjiDeck.length, 1)]
    ?? selectedKanjiEntry;
  const studyExamples = Array.isArray(selectedStudyEntry?.examples) ? selectedStudyEntry.examples.filter(Boolean) : [];
  const selectedStudyExample = studyExamples.length ? studyExamples[kanjiStudyExampleIndex % studyExamples.length] : "";
  const grammarPoints = Array.isArray(activeLesson.grammarPoints) && activeLesson.grammarPoints.length
    ? activeLesson.grammarPoints
    : [{ title: "Grammar note", explanation: activeLesson.grammar, example: activeLesson.japanese }];
  const lessonScenes = Array.isArray(activeLesson.scenes) && activeLesson.scenes.length ? activeLesson.scenes : [];
  const activeScene = lessonScenes.length ? lessonScenes[lessonSceneIndex % lessonScenes.length] : null;
  const dialogueLines = activeScene?.lines?.length
    ? activeScene.lines
    : Array.isArray(activeLesson.dialogueLines) && activeLesson.dialogueLines.length
      ? activeLesson.dialogueLines
      : [
          { speaker: "Narration", text: `${activeLesson.title} (${activeLesson.theme})` },
          { speaker: "Speaker A", text: activeLesson.japanese },
          { speaker: "Speaker B", text: activeLesson.translation },
        ].filter((line) => line.text);
  const activeDialogueLine = dialogueLines.length ? dialogueLines[lessonDialogueIndex % dialogueLines.length] : null;
  const exercises = Array.isArray(activeLesson.exercises) && activeLesson.exercises.length
    ? activeLesson.exercises
    : [{ type: "multiple-choice", prompt: `Which meaning best fits: ${activeLesson.japanese}`, choices: [activeLesson.translation, activeLesson.grammar, activeLesson.theme].filter(Boolean), answer: activeLesson.translation, explanation: activeLesson.grammar }];
  const activeExercise = exercises.length ? exercises[lessonExerciseIndex % exercises.length] : null;
  const activeExerciseKey = activeExercise?.id || `${activeLesson.id}-exercise-${lessonExerciseIndex + 1}`;
  const activeExerciseComplete = completedExercises.has(activeExerciseKey);
  const activeExerciseResult = lessonExerciseResult?.exerciseKey === activeExerciseKey ? lessonExerciseResult : null;
  const lessonChecklist = buildLessonProgressChecklist(activeLesson, state.progress, state.kanjiReviews ?? [], state.progress.savedWords ?? [], state.progress.savedKanji ?? []);
  const lessonChecklistCompleteCount = lessonChecklist.filter((item) => item.complete).length;
  const lessonNotes = state.progress.lessonNotes ?? {};
  const lessonNoteValue = lessonNotes[activeLesson.id] ?? "";
  const filteredLessons = filterLessonCatalog(state.lessons, lessonCatalogQuery, lessonCatalogTheme, lessonCatalogDifficulty);
  const nextLessonId = findNextLessonId(state.lessons, state.progress.completedLessons, state.activeLessonId);
  const popCultureNotes = Array.isArray(activeLesson.popCultureNotes) && activeLesson.popCultureNotes.length
    ? activeLesson.popCultureNotes
    : [{ title: "Context note", context: activeLesson.grammar, reference: activeLesson.translation }];
  const lessonKanjiBreakdowns = Array.isArray(activeLesson.kanjiBreakdowns) && activeLesson.kanjiBreakdowns.length
    ? activeLesson.kanjiBreakdowns
    : [];
  const moduleCards = filteredLessons.map(
    (lesson) => `
      <article class="grid-card module-card">
        ${themeArt(lesson.theme, lesson.title)}
        <p class="tag">${escapeHtml(lesson.theme)}</p>
        <h3>${escapeHtml(lesson.title)}</h3>
        <p class="muted">${escapeHtml(lesson.difficulty)} · ${state.progress.completedLessons.includes(lesson.id) ? "Completed" : "In progress"}</p>
        <p class="muted">${Array.isArray(lesson.scenes) ? lesson.scenes.length : 0} scenes · ${Array.isArray(lesson.exercises) ? lesson.exercises.length : 0} exercises</p>
        ${(() => {
          const extras = [
            [Array.isArray(lesson.media) ? lesson.media.length : 0, "media slot"],
            [Array.isArray(lesson.lessonGoals) ? lesson.lessonGoals.length : 0, "goal"],
            [Array.isArray(lesson.referenceTags) ? lesson.referenceTags.length : 0, "tag"],
          ].filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`);
          return extras.length ? `<p class="muted">${extras.join(" · ")}</p>` : "";
        })()}
        <div class="kana">${escapeHtml(state.toggles.furigana ? lesson.japanese : lesson.translation)}</div>
        ${state.toggles.romaji ? `<p class="muted">${escapeHtml(lesson.romaji)}</p>` : ""}
        ${state.toggles.translation ? `<p>${escapeHtml(lesson.translation)}</p>` : ""}
        <p>${escapeHtml(lesson.grammar)}</p>
        ${Array.isArray(lesson.popCultureNotes) && lesson.popCultureNotes.length ? `<p class="muted">${escapeHtml(lesson.popCultureNotes[0].title)} · ${escapeHtml(lesson.popCultureNotes[0].context)}</p>` : ""}
        ${
          Array.isArray(lesson.lessonGoals) && lesson.lessonGoals.length
            ? `<div class="tag-row">${lesson.lessonGoals.slice(0, 3).map((goal) => `<span class="tag">${escapeHtml(goal)}</span>`).join("")}</div>`
            : ""
        }
        ${
          Array.isArray(lesson.referenceTags) && lesson.referenceTags.length
            ? `<div class="tag-row">${lesson.referenceTags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
            : ""
        }
        <div class="tag-row">
          ${lesson.vocab
            .map((item) => `<span class="tag">${escapeHtml(item.word)} · ${escapeHtml(item.meaning)}</span>`)
            .join("")}
        </div>
        <div class="button-row">
          <button class="primary" data-action="select-lesson" data-id="${escapeHtml(lesson.id)}">${state.progress.completedLessons.includes(lesson.id) ? "Review lesson" : "Study lesson"}</button>
          <button class="secondary" data-action="speak-lesson" data-id="${escapeHtml(lesson.id)}">Play audio</button>
        </div>
      </article>
    `
  );

  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Learn through anime, food, history, and daily life</p>
        <h2>Pop culture context first, then grammar, vocab, kanji, and review.</h2>
        <p class="muted">Each lesson is a scene, a grammar note, vocabulary, kanji, practice exercises, and a place to save your notes.</p>
        <div class="button-row">
          <button class="primary" data-action="open-feature">Start a 5-minute study run</button>
          <button class="secondary" data-action="continue-lesson" data-id="${escapeHtml(nextLessonId)}">${state.progress.completedLessons.includes(nextLessonId) ? "Review next lesson" : "Continue lesson"}</button>
          <button class="secondary" data-action="open-roleplay">Open roleplay mode</button>
        </div>
      </div>
      <div class="stats-grid">
        ${renderStat("XP", state.progress.xp)}
        ${renderStat("Level", state.progress.level)}
        ${renderStat("Credits", state.progress.credits)}
        ${renderStat("Streak", `${state.progress.streak} days`)}
      </div>
    </section>
    <section class="panel lesson-layout" id="featured-lesson">
      <div class="grid-card">
        <p class="eyebrow">Featured lesson</p>
        <h2>${escapeHtml(activeLesson.title)}</h2>
        <p class="muted">${escapeHtml(activeLesson.theme)} · ${escapeHtml(activeLesson.difficulty)}</p>
        <p class="kana">${escapeHtml(state.toggles.furigana ? activeLesson.japanese : activeLesson.translation)}</p>
        ${state.toggles.romaji ? `<p class="muted">${escapeHtml(activeLesson.romaji)}</p>` : ""}
        ${state.toggles.translation ? `<p>${escapeHtml(activeLesson.translation)}</p>` : ""}
        <p>${escapeHtml(activeLesson.grammar)}</p>
        ${renderLessonSteps()}
        <div class="grid-card spaced lesson-blueprint" ${lessonStepAttr("overview")}>
          <h3>What this lesson contains</h3>
          <p class="muted">A complete lesson combines a scene, grammar notes, vocabulary, kanji, exercises, and a note-taking area.</p>
          <div class="tag-row">
            <span class="tag">Scene</span>
            <span class="tag">Grammar</span>
            <span class="tag">Vocabulary</span>
            <span class="tag">Kanji</span>
            <span class="tag">Exercises</span>
            <span class="tag">Notes</span>
          </div>
          ${
            Array.isArray(activeLesson.lessonGoals) && activeLesson.lessonGoals.length
              ? `
                <div class="tag-row">
                  ${activeLesson.lessonGoals.slice(0, 4).map((goal) => `<span class="tag">${escapeHtml(goal)}</span>`).join("")}
                </div>
              `
              : ""
          }
          ${
            Array.isArray(activeLesson.referenceTags) && activeLesson.referenceTags.length
              ? `
                <div class="tag-row">
                  ${activeLesson.referenceTags.slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
              `
              : ""
          }
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("overview")}>
          <h3>Scenario pack</h3>
          <p class="muted">Each lesson can move through multiple scenes instead of staying on one line.</p>
          <div class="tag-row">
            ${lessonScenes
              .map(
                (scene, index) => `
                  <button class="tag ${index === lessonSceneIndex % Math.max(lessonScenes.length, 1) ? "active" : ""}" data-action="select-lesson-scene" data-index="${index}">
                    ${escapeHtml(scene.title || `Scene ${index + 1}`)}
                  </button>
                `
              )
              .join("")}
          </div>
          ${
            activeScene
              ? `
                <div class="detail-card spaced">
                  <strong>${escapeHtml(activeScene.title || "Scene")}</strong>
                  <p class="muted">${escapeHtml(activeScene.setting || "Scene setting")}</p>
                  <p>${escapeHtml(activeScene.summary || "")}</p>
                  <div class="tag-row">
                    ${activeScene.sceneType ? `<span class="tag">${escapeHtml(activeScene.sceneType)}</span>` : ""}
                    ${activeScene.tone ? `<span class="tag">${escapeHtml(activeScene.tone)}</span>` : ""}
                    ${(activeScene.mediaRefs ?? []).slice(0, 3).map((reference) => `<span class="tag">${escapeHtml(reference)}</span>`).join("")}
                  </div>
                  <div class="tag-row">
                    ${(activeScene.references ?? []).slice(0, 4).map((reference) => `<span class="tag">${escapeHtml(reference)}</span>`).join("")}
                  </div>
                </div>
              `
              : "<p class='muted'>The current lesson has one scene. Add more scenes in Admin to make it a full pack.</p>"
          }
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("overview")}>
          <h3>Media references</h3>
          <p class="muted">These slots can point to screenshots, source clips, or the reference image you want learners to connect to the scene.</p>
          <div class="list">
            ${
              Array.isArray(activeLesson.media) && activeLesson.media.length
                ? activeLesson.media.map(
                    (media, index) => `
                      <div class="list-item">
                        <strong>${escapeHtml(media.title || `Media ${index + 1}`)}</strong>
                        <span class="muted">${escapeHtml(media.caption || media.alt || "Reference asset")}</span>
                        <span class="muted">${escapeHtml([media.type, media.source].filter(Boolean).join(" · ") || "local reference")}</span>
                      </div>
                    `
                  ).join("")
                : "<p class='muted'>No media references have been added yet.</p>"
              }
          </div>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("overview")}>
          <h3>Pop-culture notes</h3>
          <p class="muted">These notes explain why the lesson feels natural in anime, manga, workplace, or everyday Japanese context.</p>
          <div class="list">
            ${
              Array.isArray(activeLesson.popCultureNotes) && activeLesson.popCultureNotes.length
                ? activeLesson.popCultureNotes.map(
                    (note, index) => `
                      <div class="list-item">
                        <strong>${escapeHtml(note.title || `Note ${index + 1}`)}</strong>
                        <span class="muted">${escapeHtml(note.context || "")}</span>
                        <span class="muted">${escapeHtml([note.reference, note.sceneHint, note.sourceType].filter(Boolean).join(" · "))}</span>
                      </div>
                    `
                  ).join("")
                : "<p class='muted'>No pop-culture notes are attached to this lesson yet.</p>"
            }
          </div>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("overview")}>
          <h3>Lesson mastery</h3>
          <p class="muted">${lessonChecklistCompleteCount}/${lessonChecklist.length} goals complete</p>
          <div class="meter"><span style="width: ${Math.round((lessonChecklistCompleteCount / Math.max(lessonChecklist.length, 1)) * 100)}%"></span></div>
          <div class="list spaced">
            ${lessonChecklist
              .map(
                (item) => `
                  <div class="list-item">
                    <strong>${item.complete ? "✓" : "○"} ${escapeHtml(item.label)}</strong>
                    <span class="muted">${escapeHtml(item.detail)}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("grammar")}>
          <h3>Grammar points</h3>
          <div class="list">
            ${grammarPoints
              .map(
                (point) => `
                  <article class="list-item">
                    <div>
                      <strong>${escapeHtml(point.title || "Grammar point")}</strong>
                      <span>${escapeHtml(point.explanation || "")}</span>
                      ${point.example ? `<span class="muted">${escapeHtml(point.example)}</span>` : ""}
                    </div>
                    <div class="button-row">
                      <button class="secondary" data-action="append-lesson-note" data-lesson-id="${escapeHtml(activeLesson.id)}" data-snippet="${escapeHtml(`${point.title || "Grammar"}: ${point.explanation || ""}`)}">Add to note</button>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("grammar")}>
          <h3>Pop culture context</h3>
          <p class="muted">This is the scene-specific context that connects the line to anime, manga, food, travel, school, or office life.</p>
          <div class="list">
            ${popCultureNotes
              .map(
                (note) => `
                  <article class="list-item">
                    <div>
                      <strong>${escapeHtml(note.title || "Context note")}</strong>
                      <span>${escapeHtml(note.context || "")}</span>
                      ${note.reference ? `<span class="muted">${escapeHtml(note.reference)}</span>` : ""}
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("notes")}>
          <h3>Lesson notes</h3>
          <p class="muted">Capture a reminder, grammar note, or translation trick for this lesson.</p>
          <label class="field">
            <span>Notes for ${escapeHtml(activeLesson.title)}</span>
            <textarea rows="4" data-field="lesson-note-input">${escapeHtml(lessonNoteValue)}</textarea>
          </label>
          <div class="tag-row">
            <button class="tag" data-action="fill-lesson-note" data-value="Grammar:">${"Grammar note"}</button>
            <button class="tag" data-action="fill-lesson-note" data-value="Vocab:">${"Vocabulary note"}</button>
            <button class="tag" data-action="fill-lesson-note" data-value="Remember:">${"Study reminder"}</button>
          </div>
          <div class="button-row">
            <button class="primary" data-action="save-lesson-note" data-lesson-id="${escapeHtml(activeLesson.id)}">Save note</button>
            <button class="secondary" data-action="save-lesson-note" data-lesson-id="${escapeHtml(activeLesson.id)}" data-clear="true">Clear note</button>
          </div>
          <p class="muted" data-output="lesson-note-feedback">${escapeHtml(lessonNoteFeedback || "No note saved yet.")}</p>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("scene")}>
          <h3>Dialogue scene</h3>
          <p class="muted">Step through the current scene instead of reading it as a single block.</p>
          <div class="chat">
            ${dialogueLines
              .map(
                (line, index) => `
                  <button class="chat-line ${index === lessonDialogueIndex % dialogueLines.length ? "active" : ""}" data-action="select-dialogue-line" data-index="${index}" data-line-text="${escapeHtml(line.text)}">
                    <span class="chat-speaker">${escapeHtml(line.speaker || "Speaker")}</span>
                    <span>${escapeHtml(line.text || "")}</span>
                  </button>
                `
              )
              .join("")}
          </div>
          ${
            activeDialogueLine
              ? `
                <div class="detail-card spaced">
                  <strong>${escapeHtml(activeDialogueLine.speaker || "Speaker")}</strong>
                  <p>${escapeHtml(activeDialogueLine.text || "")}</p>
                </div>
                <div class="button-row">
                  <button class="secondary" data-action="dialogue-prev">Previous line</button>
                  <button class="secondary" data-action="dialogue-next">Next line</button>
                  <button class="primary" data-action="speak-dialogue-line">Play line</button>
                </div>
                <div class="button-row">
                  <button class="secondary" data-action="scene-prev">Previous scene</button>
                  <button class="secondary" data-action="scene-next">Next scene</button>
                </div>
              `
              : ""
          }
        </div>
        <div ${lessonStepAttr("scene")}>
          <div class="button-row">
            <button class="secondary" data-action="speak-lesson" data-id="${activeLesson.id}">Listen to line</button>
            <button class="secondary" data-action="explain-grammar" data-id="${activeLesson.id}">Explain grammar</button>
          </div>
          <p class="${feedbackClass(state.tutor.answer)}" data-output="grammar-feedback">${escapeHtml(state.tutor.answer)}</p>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("practice")}>
          <h3>Lesson exercises</h3>
          <p class="muted">${completedExercises.size}/${exercises.length} completed</p>
          <div class="detail-card">
            ${
              activeExercise
                ? `
                  <p class="eyebrow">Exercise ${lessonExerciseIndex + 1} of ${exercises.length}</p>
                  <strong>${escapeHtml(activeExercise.type || "exercise")}</strong>
                  <p class="muted">${escapeHtml(describeLessonExerciseType(activeExercise.type))}</p>
                  ${activeExercise.hint ? `<p class="muted">${escapeHtml(activeExercise.hint)}</p>` : ""}
                  <p>${escapeHtml(activeExercise.prompt || "")}</p>
                  ${
                    Array.isArray(activeExercise.choices) && activeExercise.choices.length
                      ? `
                        <div class="tag-row">
                          ${activeExercise.choices
                            .map((choice) => {
                              const isCorrectChoice = activeExerciseResult?.correct && choice === activeExerciseResult.answer;
                              const isWrongChoice = activeExerciseResult && !activeExerciseResult.correct && choice === activeExerciseResult.selected;
                              const choiceClass = isCorrectChoice ? "exercise-choice exercise-correct" : isWrongChoice ? "exercise-choice exercise-wrong" : "exercise-choice";
                              return `<button class="chip ${choiceClass}" data-action="lesson-exercise-answer" data-choice="${escapeHtml(choice)}" data-exercise-key="${escapeHtml(activeExerciseKey)}" data-lesson-id="${escapeHtml(activeLesson.id)}">${escapeHtml(choice)}</button>`;
                            })
                            .join("")}
                        </div>
                      `
                      : `
                        <label class="field">
                          <span>Your answer</span>
                          <textarea rows="3" data-field="lesson-exercise-input">${escapeHtml(lessonExerciseDraftAnswer)}</textarea>
                        </label>
                        <div class="button-row">
                          <button class="primary" data-action="lesson-exercise-submit" data-exercise-key="${escapeHtml(activeExerciseKey)}" data-lesson-id="${escapeHtml(activeLesson.id)}">Check exercise</button>
                        </div>
                      `
                  }
                  <p class="muted">${activeExerciseComplete ? "Completed and saved." : "Answer the exercise to earn study rewards."}</p>
                  <div class="button-row">
                    <button class="secondary" data-action="lesson-exercise-prev">Previous exercise</button>
                    <button class="secondary" data-action="lesson-exercise-next">Next exercise</button>
                  </div>
                  <p class="${feedbackClass(lessonExerciseFeedback || state.tutor.answer)}" data-output="lesson-exercise-feedback">${escapeHtml(lessonExerciseFeedback || state.tutor.answer)}</p>
                `
                : "<p class='muted'>No exercises available for this lesson yet.</p>"
            }
          </div>
        </div>
        <div class="grid-card spaced" ${lessonStepAttr("scene")}>
          <h3>Tap-through reading</h3>
          <div class="list">
            ${activeLesson.vocab
              .map(
                (item) => `
                  <button class="list-item" data-action="lookup-word" data-term="${escapeHtml(item.word)}">
                    <strong>${escapeHtml(item.word)}</strong>
                    <span class="muted">${escapeHtml(item.kana)}</span>
                    <span>${escapeHtml(item.meaning)}</span>
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
        <div class="grid-card lesson-words" ${lessonStepAttr("words")}>
        <h3>Vocabulary</h3>
        <div class="list">
          ${activeLesson.vocab
            .map(
              (item) => `
                <div class="list-item">
                  <strong>${escapeHtml(item.word)}</strong>
                  <div class="muted">${escapeHtml(item.kana)}</div>
                  <div>${escapeHtml(item.meaning)}</div>
                  <div class="button-row">
                    <button class="secondary" data-action="append-lesson-note" data-lesson-id="${escapeHtml(activeLesson.id)}" data-snippet="${escapeHtml(`${item.word} (${item.kana}): ${item.meaning}`)}">Add to note</button>
                    <button class="secondary" data-action="toggle-word-bookmark" data-word="${escapeHtml(item.word)}" data-reading="${escapeHtml(item.kana)}" data-meaning="${escapeHtml(item.meaning)}" data-example="${escapeHtml(activeLesson.japanese)}" data-source-lesson-id="${escapeHtml(activeLesson.id)}" data-source-lesson-title="${escapeHtml(activeLesson.title)}">${savedWords.has(savedWordKey(item.word, item.kana)) ? "Remove bookmark" : "Save word"}</button>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
        <h3 class="spaced">Kanji</h3>
        <div class="list">
          ${activeLesson.kanji
            .map((item) => {
              const entry = kanjiDeck.find((kanjiItem) => kanjiItem.character === item) ?? null;
              const bookmarked = savedKanji.has(savedKanjiKey(item));
              return `
                <div class="list-item">
                  <button class="list-item compact" data-action="lookup-kanji" data-term="${escapeHtml(item)}">
                    <strong>${escapeHtml(item)}</strong>
                    <span class="muted">${escapeHtml(entry?.onYomi || "—")} / ${escapeHtml(entry?.kunYomi || "—")}</span>
                    <span>${escapeHtml(entry?.meaning ?? "Kanji from this lesson")}</span>
                  </button>
                  <div class="button-row">
                    <button class="secondary" data-action="toggle-kanji-bookmark" data-character="${escapeHtml(item)}" data-meaning="${escapeHtml(entry?.meaning ?? item)}" data-on-yomi="${escapeHtml(entry?.onYomi ?? "")}" data-kun-yomi="${escapeHtml(entry?.kunYomi ?? "")}" data-examples="${escapeHtml(JSON.stringify(entry?.examples ?? []))}" data-source-lesson-id="${escapeHtml(activeLesson.id)}" data-source-lesson-title="${escapeHtml(activeLesson.title)}">${bookmarked ? "Remove bookmark" : "Save kanji"}</button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="grid-card nested spaced">
          <p class="eyebrow">Lesson kanji breakdowns</p>
          <div class="list">
            ${lessonKanjiBreakdowns.length
              ? lessonKanjiBreakdowns
                  .map(
                    (entry) => `
                      <div class="list-item">
                        <div>
                          <strong>${escapeHtml(entry.character)}</strong>
                          <span class="muted">${escapeHtml(entry.onYomi || "—")} / ${escapeHtml(entry.kunYomi || "—")}</span>
                          <span>${escapeHtml(entry.meaning || "")}</span>
                          <span class="muted">Group: ${escapeHtml(entry.group || "—")} · Difficulty: ${escapeHtml(entry.difficulty || "—")} · Strokes: ${escapeHtml(String(entry.strokeCount ?? "—"))}</span>
                          ${entry.components ? `<span class="muted">Components: ${escapeHtml(entry.components)}</span>` : ""}
                          ${entry.mnemonic ? `<span class="muted">Mnemonic: ${escapeHtml(entry.mnemonic)}</span>` : ""}
                          ${entry.lessonContext ? `<span class="muted">Context: ${escapeHtml(entry.lessonContext)}</span>` : ""}
                          ${Array.isArray(entry.lessonExamples) && entry.lessonExamples.length ? `<span class="muted">Lesson words: ${escapeHtml(entry.lessonExamples.join(" · "))}</span>` : ""}
                          ${Array.isArray(entry.relatedKanji) && entry.relatedKanji.length ? `<span class="muted">Related: ${escapeHtml(entry.relatedKanji.join(" · "))}</span>` : ""}
                        </div>
                      </div>
                    `
                  )
                  .join("")
              : "<p class='muted'>Add kanji breakdowns to show components and mnemonics here.</p>"}
          </div>
        </div>
        <div class="grid-card nested spaced">
          <p class="eyebrow">Kanji library</p>
          <div class="list">
            ${kanjiDeck
              .slice(0, 6)
              .map(
                (entry) => `
                  <button class="list-item" data-action="lookup-kanji" data-term="${escapeHtml(entry.character)}">
                    <strong>${escapeHtml(entry.character)}</strong>
                    <span class="muted">${escapeHtml(entry.onYomi || "—")} · ${escapeHtml(entry.kunYomi || "—")}</span>
                    <span>${escapeHtml(entry.meaning)}</span>
                  </button>
                `
              )
              .join("")}
          </div>
          <div class="detail-card spaced">
            ${
              selectedKanjiEntry
                ? `
                  <strong>${escapeHtml(selectedKanjiEntry.character)}</strong>
                  <p class="muted">${escapeHtml(selectedKanjiEntry.onYomi || "No on-yomi stored")} / ${escapeHtml(selectedKanjiEntry.kunYomi || "No kun-yomi stored")}</p>
                  <p>${escapeHtml(selectedKanjiEntry.meaning)}</p>
                  <p class="muted">Group: ${escapeHtml(selectedKanjiEntry.groupName || selectedKanjiEntry.group || "—")} · Difficulty: ${escapeHtml(selectedKanjiEntry.difficulty || "—")} · Strokes: ${escapeHtml(String(selectedKanjiEntry.strokeCount ?? "—"))}</p>
                  <p class="muted">${escapeHtml((selectedKanjiEntry.examples ?? []).slice(0, 2).join(" · ") || "No examples available.")}</p>
                  ${Array.isArray(selectedKanjiEntry.relatedKanji) && selectedKanjiEntry.relatedKanji.length ? `<p class="muted">Related kanji: ${escapeHtml(selectedKanjiEntry.relatedKanji.join(" · "))}</p>` : ""}
                `
                : "<p class='muted'>Select a kanji to see readings and examples.</p>"
            }
          </div>
        </div>
        <div class="grid-card nested spaced">
          <p class="eyebrow">Kanji study deck</p>
          ${
            selectedStudyEntry
              ? `
                <div class="kanji-focus">
                  <strong>${escapeHtml(selectedStudyEntry.character)}</strong>
                  <span class="tag">${escapeHtml(selectedStudyEntry.meaning)}</span>
                </div>
                <p class="muted">${escapeHtml(selectedStudyEntry.onYomi || "No on-yomi stored")} / ${escapeHtml(selectedStudyEntry.kunYomi || "No kun-yomi stored")}</p>
                <p>${escapeHtml(selectedStudyEntry.meaning)}</p>
                <p class="muted">Group: ${escapeHtml(selectedStudyEntry.groupName || selectedStudyEntry.group || "—")} · Difficulty: ${escapeHtml(selectedStudyEntry.difficulty || "—")} · Strokes: ${escapeHtml(String(selectedStudyEntry.strokeCount ?? "—"))}</p>
                <p class="muted">${escapeHtml(selectedStudyExample || (studyExamples.length ? studyExamples[0] : "No examples available."))}</p>
                ${Array.isArray(selectedStudyEntry.relatedKanji) && selectedStudyEntry.relatedKanji.length ? `<p class="muted">Related kanji: ${escapeHtml(selectedStudyEntry.relatedKanji.join(" · "))}</p>` : ""}
                ${
                  lessonKanjiBreakdowns.find((entry) => entry.character === selectedStudyEntry.character)
                    ? (() => {
                        const lessonBreakdown = lessonKanjiBreakdowns.find((entry) => entry.character === selectedStudyEntry.character);
                        return `
                          <p class="muted">Components: ${escapeHtml(lessonBreakdown.components || "—")}</p>
                          <p class="muted">Mnemonic: ${escapeHtml(lessonBreakdown.mnemonic || "—")}</p>
                          <p class="muted">Context: ${escapeHtml(lessonBreakdown.lessonContext || "—")}</p>
                          <p class="muted">Group: ${escapeHtml(lessonBreakdown.group || "—")} · Difficulty: ${escapeHtml(lessonBreakdown.difficulty || "—")} · Strokes: ${escapeHtml(String(lessonBreakdown.strokeCount ?? "—"))}</p>
                          ${Array.isArray(lessonBreakdown.relatedKanji) && lessonBreakdown.relatedKanji.length ? `<p class="muted">Related kanji: ${escapeHtml(lessonBreakdown.relatedKanji.join(" · "))}</p>` : ""}
                          ${Array.isArray(lessonBreakdown.lessonExamples) && lessonBreakdown.lessonExamples.length ? `<p class="muted">Lesson words: ${escapeHtml(lessonBreakdown.lessonExamples.join(" · "))}</p>` : ""}
                        `;
                      })()
                    : ""
                }
                <div class="button-row">
                  <button class="secondary" data-action="kanji-study-prev">Previous kanji</button>
                  <button class="secondary" data-action="kanji-study-next">Next kanji</button>
                  <button class="secondary" data-action="kanji-study-example">Next example</button>
                </div>
              `
              : "<p class='muted'>Your kanji library will appear here once entries are seeded or imported.</p>"
          }
        </div>
      </div>
      ${renderLessonStepFooter(activeLesson.id)}
    </section>
    <section class="panel spaced">
      <div class="section-title">
        <div>
          <p class="eyebrow">Lesson explorer</p>
          <h2>Search and filter modules</h2>
        </div>
        <p>${filteredLessons.length}/${state.lessons.length} lessons shown</p>
      </div>
      <div class="grid-card">
        <div class="field-row">
          <label class="field">
            <span>Search</span>
            <input type="text" data-field="lesson-filter-query" value="${escapeHtml(lessonCatalogQuery)}" placeholder="ramen, station, polite" />
          </label>
          <label class="field">
            <span>Theme</span>
            <input type="text" data-field="lesson-filter-theme" value="${escapeHtml(lessonCatalogTheme)}" placeholder="anime, travel, manga" />
          </label>
          <label class="field">
            <span>Difficulty</span>
            <input type="text" data-field="lesson-filter-difficulty" value="${escapeHtml(lessonCatalogDifficulty)}" placeholder="N5" />
          </label>
        </div>
        <div class="button-row">
          <button class="primary" data-action="apply-lesson-filters">Apply filters</button>
          <button class="secondary" data-action="clear-lesson-filters">Clear filters</button>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Pop culture modules</p>
          <h2>Theme-based learning modules</h2>
        </div>
        <p>Anime dialogue, food culture, samurai history, daily life.</p>
      </div>
      ${
        moduleCards.length
          ? `<div class="module-grid">${moduleCards.join("")}</div>`
          : "<p class='muted'>No lessons match the current filters.</p>"
      }
    </section>
  `;
}

function renderPractice() {
  const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
  const listeningScenario = listeningScenarios[listeningScenarioIndex % listeningScenarios.length];
  const speakingPrompt = speakingPrompts[speakingPromptIndex % speakingPrompts.length];
  const selectedDictionaryEntry = readingSelection ?? dictionaryLookup[0] ?? null;
  const savedWords = new Map((state.progress.savedWords ?? []).map((item) => [savedWordKey(item.term, item.reading), item]));
  const savedKanji = new Map((state.progress.savedKanji ?? []).map((item) => [savedKanjiKey(item.character), item]));
  const lessonKanjiBreakdowns = Array.isArray(activeLesson?.kanjiBreakdowns) ? activeLesson.kanjiBreakdowns : [];
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Practice</p>
          <h2>Speaking, listening, reading, and writing</h2>
        </div>
        <p>Each card is one drill: speak, listen, tap words, then review the correction.</p>
      </div>
      <div class="practice-grid">
        ${practiceCard(
          "Speaking",
          "Record yourself, transcribe locally when available, then compare your sentence against a natural Japanese correction.",
          ["Local STT", "Local TTS", "Suggest natural phrasing"],
          `
            <p>${escapeHtml(speakingPrompt.title)}</p>
            <p class="muted">${escapeHtml(speakingPrompt.prompt)}</p>
            <label class="field">
              <span>Try saying</span>
              <input type="text" data-field="speaking-input" value="${escapeHtml(speakingPrompt.reference)}" />
            </label>
            <div class="tag-row">
              <button class="chip" data-action="speaking-starter" data-value="ラーメンをください。">Ramen</button>
              <button class="chip" data-action="speaking-starter" data-value="切符売り場はどこですか。">Station</button>
              <button class="chip" data-action="speaking-starter" data-value="私は毎日日本語を勉強します。">Study</button>
            </div>
            <div class="button-row">
              <button class="secondary" data-action="transcribe-speaking">Transcribe</button>
              <button class="primary" data-action="check-speaking">Check speech</button>
              <button class="secondary" data-action="next-speaking">Next prompt</button>
              <button class="secondary" data-action="play-sample">Play sample</button>
            </div>
            <p class="feedback feedback-neutral" data-output="transcription-feedback">No transcript yet. Use browser speech recognition when available.</p>
            <p class="${feedbackClass(state.tutor.answer)}" data-output="speaking-feedback">${escapeHtml(state.tutor.answer)}</p>
          `
        )}
        ${practiceCard(
          "Listening",
          "Play a scene and answer a quick comprehension prompt.",
          ["Local TTS", "Static quiz", "Replay line"],
          `
            <p>${escapeHtml(listeningScenario.title)}</p>
            <p class="muted">${escapeHtml(listeningScenario.question)}</p>
            <div class="button-row">
              <button class="secondary" data-action="replay-listening">Replay line</button>
              <button class="secondary" data-action="next-listening">Next scene</button>
            </div>
            <div class="tag-row">
              ${listeningScenario.choices
                .map(
                  (choice) =>
                    `<button class="chip" data-action="listening-answer" data-answer="${escapeHtml(choice.key)}" data-answer-key="${escapeHtml(listeningScenario.answerKey)}" data-prompt="${escapeHtml(listeningScenario.prompt)}">${escapeHtml(choice.label)}</button>`
                )
                .join("")}
            </div>
            <p class="feedback feedback-neutral" data-output="listening-feedback">Choose the best answer after listening.</p>
          `
        )}
        ${practiceCard(
          "Reading",
          "Tap a word to reveal meaning, kana, and kanji details.",
          ["Furigana toggle", "Translation toggle", "Dictionary lookup"],
          `
            <div class="tag-row">
              ${activeLessonPreview()
                .slice(0, 3)
                .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
                .join("")}
            </div>
            <div class="list">
              ${state.lessons
                .find((lesson) => lesson.id === state.activeLessonId)
                ?.vocab.map((item) => `<button class="list-item" data-action="lookup-word" data-term="${escapeHtml(item.word)}">${escapeHtml(item.word)} · ${escapeHtml(item.kana)} · ${escapeHtml(item.meaning)}</button>`)
                .join("") ?? ""}
            </div>
            <label class="field spaced">
              <span>Lookup term</span>
              <input type="text" data-field="dictionary-input" placeholder="よろしく" />
            </label>
            <div class="button-row">
              <button class="primary" data-action="lookup-dictionary">Lookup</button>
              <button class="secondary" data-action="clear-dictionary">Clear</button>
            </div>
            <h4 class="spaced">Kanji lookup</h4>
            <div class="list">
              ${(state.kanjiEntries ?? [])
                .slice(0, 6)
                .map(
                  (entry) => `<button class="list-item" data-action="lookup-kanji" data-term="${escapeHtml(entry.character)}">${escapeHtml(entry.character)} · ${escapeHtml(entry.meaning)}</button>`
                )
                .join("")}
            </div>
            <div class="grid-card">
              <p class="eyebrow">Dictionary result</p>
              <p class="muted" data-output="dictionary-feedback">${
                dictionaryLookup.length
                  ? dictionaryLookup
                      .map((item) => escapeHtml(`${item.term} (${item.reading || "—"}) · ${item.meaning}`))
                      .join(" | ")
                  : "Search a word to see a local dictionary entry."
              }</p>
              <div class="detail-card spaced">
                ${
                  selectedDictionaryEntry
                    ? `
                      <strong>${escapeHtml(selectedDictionaryEntry.term)}</strong>
                      <p class="muted">${escapeHtml(selectedDictionaryEntry.reading || "No reading stored")}</p>
                      <p>${escapeHtml(selectedDictionaryEntry.meaning)}</p>
                      <p class="muted">${escapeHtml(selectedDictionaryEntry.partOfSpeech || "—")}</p>
                      <p class="muted">${escapeHtml(selectedDictionaryEntry.example || "No example available.")}</p>
                      <div class="button-row">
                        <button class="secondary" data-action="toggle-word-bookmark" data-word="${escapeHtml(selectedDictionaryEntry.term)}" data-reading="${escapeHtml(selectedDictionaryEntry.reading ?? "")}" data-meaning="${escapeHtml(selectedDictionaryEntry.meaning ?? "")}" data-example="${escapeHtml(selectedDictionaryEntry.example ?? "")}" data-source="${escapeHtml(selectedDictionaryEntry.source ?? "dictionary")}">${savedWords.has(savedWordKey(selectedDictionaryEntry.term, selectedDictionaryEntry.reading)) ? "Remove bookmark" : "Save word"}</button>
                      </div>
                    `
                    : "<p class='muted'>Tap a word or search for a dictionary entry to see details here.</p>"
                }
              </div>
            </div>
            <div class="grid-card spaced">
              <p class="eyebrow">Kanji result</p>
              <div class="detail-card">
                ${
                  kanjiSelection
                    ? (() => {
                        const lessonBreakdown = lessonKanjiBreakdowns.find((entry) => entry.character === kanjiSelection.character);
                        return `
                          <strong>${escapeHtml(kanjiSelection.character)}</strong>
                          <p class="muted">${escapeHtml(kanjiSelection.onYomi || "No on-yomi stored")} / ${escapeHtml(kanjiSelection.kunYomi || "No kun-yomi stored")}</p>
                          <p>${escapeHtml(kanjiSelection.meaning)}</p>
                          <p class="muted">${escapeHtml((kanjiSelection.examples ?? []).slice(0, 2).join(" · ") || "No examples available.")}</p>
                          ${
                            lessonBreakdown
                              ? `
                                <p class="muted">Components: ${escapeHtml(lessonBreakdown.components || "—")}</p>
                                <p class="muted">Mnemonic: ${escapeHtml(lessonBreakdown.mnemonic || "—")}</p>
                                <p class="muted">Context: ${escapeHtml(lessonBreakdown.lessonContext || "—")}</p>
                                ${Array.isArray(lessonBreakdown.lessonExamples) && lessonBreakdown.lessonExamples.length ? `<p class="muted">Lesson words: ${escapeHtml(lessonBreakdown.lessonExamples.join(" · "))}</p>` : ""}
                              `
                              : ""
                          }
                          <div class="button-row">
                            <button class="secondary" data-action="toggle-kanji-bookmark" data-character="${escapeHtml(kanjiSelection.character)}" data-meaning="${escapeHtml(kanjiSelection.meaning ?? "")}" data-on-yomi="${escapeHtml(kanjiSelection.onYomi ?? "")}" data-kun-yomi="${escapeHtml(kanjiSelection.kunYomi ?? "")}" data-examples="${escapeHtml(JSON.stringify(kanjiSelection.examples ?? []))}" data-source="${escapeHtml(kanjiSelection.source ?? "kanji")}">${savedKanji.has(savedKanjiKey(kanjiSelection.character)) ? "Remove bookmark" : "Save kanji"}</button>
                          </div>
                        `;
                      })()
                    : "<p class='muted'>Select a kanji to inspect it here.</p>"
                }
              </div>
            </div>
          `
        )}
        ${practiceCard(
          "Writing",
          "Build sentences and validate them against simple rules or local AI corrections.",
          ["Sentence builder", "Typing drill", "Grammar feedback"],
          `
            <label class="field">
              <span>Sentence</span>
              <textarea rows="4" data-field="writing-input">私は毎日日本語を勉強します。</textarea>
            </label>
            <div class="tag-row">
              <button class="chip" data-action="writing-starter" data-value="ラーメンをください。">Restaurant</button>
              <button class="chip" data-action="writing-starter" data-value="今日は日本語を勉強します。">Study</button>
              <button class="chip" data-action="writing-starter" data-value="駅はどこですか。">Directions</button>
            </div>
            <div class="button-row">
              <button class="primary" data-action="check-writing">Review writing</button>
            </div>
            <p class="feedback feedback-neutral" data-output="writing-feedback">Use particles, polite forms, and short sentences.</p>
          `
        )}
        ${practiceCard(
          "AI Tutor",
          "Ask about grammar, meaning, or nuance. The local helper keeps responses brief and cheap.",
          ["Short prompts", "No long history", "Local-first"],
          `
            <label class="field">
              <span>Question</span>
              <input type="text" data-field="tutor-input" value="${escapeHtml(state.tutor.question)}" />
            </label>
            <div class="button-row">
              <button class="primary" data-action="ask-tutor">Ask tutor</button>
            </div>
            <p class="${feedbackClass(state.tutor.answer)}" data-output="tutor-feedback">${escapeHtml(state.tutor.answer)}</p>
          `
        )}
        ${practiceCard(
          "Roleplay",
          "Restaurant, travel, and anime-style conversation prompts with short context windows.",
          ["Restaurant", "Anime style", "Travel"],
          `
            <label class="field">
              <span>Scenario</span>
              <select data-field="roleplay-scenario">
                <option value="restaurant" ${state.roleplay.scenario === "restaurant" ? "selected" : ""}>Restaurant</option>
                <option value="travel" ${state.roleplay.scenario === "travel" ? "selected" : ""}>Travel</option>
                <option value="anime" ${state.roleplay.scenario === "anime" ? "selected" : ""}>Anime style</option>
              </select>
            </label>
            <div class="chat" data-output="roleplay-chat">
              ${state.roleplay.transcript
                .map(
                  (line) => `
                    <div class="chat-line">
                      <span class="chat-speaker">${line.speaker}</span>
                      <span>${line.text}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
            <label class="field spaced">
              <span>Your reply</span>
              <textarea rows="3" data-field="roleplay-input">${escapeHtml(roleplayDraft)}</textarea>
            </label>
            <div class="button-row">
              <button class="primary" data-action="send-roleplay">Reply naturally</button>
              <button class="secondary" data-action="roleplay-reset">Reset scene</button>
            </div>
          `
        )}
      </div>
    </section>
  `;
}

function renderReview() {
  const kanjiQueue = Array.isArray(state.kanjiReviews) ? state.kanjiReviews : [];
  const kanjiReview = kanjiQueue.length ? kanjiQueue[kanjiReviewIndex % kanjiQueue.length] : null;
  const kanjiChoices = kanjiReview ? buildKanjiQuizChoices(kanjiReview, kanjiQueue, state.kanjiEntries ?? []) : [];
  const reviewQueue = Array.isArray(state.reviews) ? state.reviews : [];
  const activeReview = reviewQueue.length ? reviewQueue[reviewDeckIndex % reviewQueue.length] : null;
  const savedWordQueue = (state.progress.savedWords ?? []).map((item) => ({ ...item, kind: "word", display: item.term, detail: `${item.reading || "—"} · ${item.meaning || ""}`.trim() }));
  const savedKanjiQueue = (state.progress.savedKanji ?? []).map((item) => ({ ...item, kind: "kanji", display: item.character, detail: `${item.onYomi || "—"} / ${item.kunYomi || "—"} · ${item.meaning || ""}`.trim() }));
  const savedStudyDeck = savedStudyMode === "words"
    ? savedWordQueue
    : savedStudyMode === "kanji"
      ? savedKanjiQueue
      : [...savedWordQueue, ...savedKanjiQueue];
  const activeSavedStudy = savedStudyDeck.length ? savedStudyDeck[savedStudyIndex % savedStudyDeck.length] : null;
  const savedStudyChoices = activeSavedStudy
    ? buildSavedStudyChoices(activeSavedStudy, savedWordQueue, savedKanjiQueue, state.reviews ?? [], state.kanjiReviews ?? [], state.lessons ?? [])
    : [];
  const items = state.reviews
    .map(
      (item) => `
        <div class="list-item">
          <strong>${escapeHtml(item.prompt)}</strong>
          <p class="muted">${escapeHtml(item.meaning)}</p>
          <p>Answer: ${escapeHtml(item.answer)}</p>
          <p>Due: ${escapeHtml(item.due)} · Ease: ${escapeHtml(item.ease.toFixed(1))}</p>
          <div class="button-row">
            <button class="secondary" data-action="grade-review" data-review-id="${escapeHtml(item.id)}" data-grade="2">Again</button>
            <button class="secondary" data-action="grade-review" data-review-id="${escapeHtml(item.id)}" data-grade="3">Hard</button>
            <button class="primary" data-action="grade-review" data-review-id="${escapeHtml(item.id)}" data-grade="4">Good</button>
            <button class="secondary" data-action="grade-review" data-review-id="${escapeHtml(item.id)}" data-grade="5">Easy</button>
          </div>
        </div>
      `
    )
    .join("");

  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">SRS</p>
          <h2>Review queue</h2>
        </div>
        <p>SM-2 scheduling, mistake review, vocab review, kanji review.</p>
      </div>
      <div class="grid-card spaced" data-flashcard>
        <h3>Vocab flashcard</h3>
        ${
          activeReview
            ? `
              <p class="muted">Card ${reviewDeckIndex + 1} of ${reviewQueue.length}</p>
              <div class="kanji-focus">
                <strong>${escapeHtml(activeReview.prompt)}</strong>
                <span class="tag">${escapeHtml(activeReview.due)}</span>
              </div>
              <p class="muted">${escapeHtml(activeReview.meaning)}</p>
              ${
                reviewReveal
                  ? `
                    <div class="detail-card spaced">
                      <p><strong>Answer:</strong> ${escapeHtml(activeReview.answer)}</p>
                      <p class="muted">Ease: ${escapeHtml(activeReview.ease.toFixed(1))} · Due: ${escapeHtml(activeReview.due)}</p>
                    </div>
                  `
                  : `
                    <p class="muted">Tap reveal to check the answer, then grade the card.</p>
                    <p class="muted shortcut-hint">Keyboard: <kbd>Space</kbd> reveal · <kbd>1</kbd>–<kbd>4</kbd> grade · <kbd>←</kbd> <kbd>→</kbd> move</p>
                  `
              }
              <div class="button-row">
                <button class="secondary" data-action="toggle-word-bookmark" data-word="${escapeHtml(activeReview.prompt)}" data-reading="${escapeHtml(activeReview.answer)}" data-meaning="${escapeHtml(activeReview.meaning)}" data-example="${escapeHtml(activeReview.prompt)}" data-source="review" data-source-lesson-id="${escapeHtml(activeReview.source_lesson_id ?? "")}" data-source-lesson-title="${escapeHtml(activeReview.sourceLessonTitle ?? "")}">${savedWordQueue.some((item) => item.term === activeReview.prompt && item.reading === activeReview.answer) ? "Remove from saved" : "Save to review deck"}</button>
              </div>
              <div class="button-row">
                <button class="secondary" data-action="review-prev-card">Previous card</button>
                <button class="primary" data-action="review-reveal-card">${reviewReveal ? "Hide answer" : "Reveal answer"}</button>
                <button class="secondary" data-action="review-next-card">Next card</button>
              </div>
              ${
                reviewReveal
                  ? `
                    <div class="button-row">
                      <button class="secondary" data-action="grade-review" data-review-id="${escapeHtml(activeReview.id)}" data-grade="2">Again</button>
                      <button class="secondary" data-action="grade-review" data-review-id="${escapeHtml(activeReview.id)}" data-grade="3">Hard</button>
                      <button class="primary" data-action="grade-review" data-review-id="${escapeHtml(activeReview.id)}" data-grade="4">Good</button>
                      <button class="secondary" data-action="grade-review" data-review-id="${escapeHtml(activeReview.id)}" data-grade="5">Easy</button>
                    </div>
                  `
                  : ""
              }
            `
            : "<p class='muted'>No vocab cards are available yet.</p>"
        }
      </div>
      <div class="chest-row">
        <div class="grid-card">
          <h3>Reward chest</h3>
          <p>Open milestone rewards when you keep the streak alive.</p>
          <p class="muted">Last reward: ${state.chest.lastReward}</p>
          <button class="primary" data-action="open-chest">Open chest</button>
        </div>
        <div class="grid-card">
          <h3>Weekly leaderboard</h3>
          ${renderLeaderboard()}
        </div>
      </div>
      <div class="grid-card spaced">
        <h3>Saved study deck</h3>
        <p class="muted">Revisit bookmarked words and kanji without leaving Review.</p>
        <div class="button-row">
          <button class="secondary" data-action="saved-study-mode" data-mode="all">All</button>
          <button class="secondary" data-action="saved-study-mode" data-mode="words">Words</button>
          <button class="secondary" data-action="saved-study-mode" data-mode="kanji">Kanji</button>
        </div>
        ${
          activeSavedStudy
            ? `
              <p class="muted">Card ${savedStudyIndex + 1} of ${savedStudyDeck.length} · ${escapeHtml(activeSavedStudy.kind)}</p>
              <div class="kanji-focus">
                <strong>${escapeHtml(activeSavedStudy.display)}</strong>
                <span class="tag">${escapeHtml(activeSavedStudy.kind)}</span>
              </div>
              <p class="muted">${escapeHtml(activeSavedStudy.detail || "—")}</p>
              ${
                savedStudyChoices.length
                  ? `
                    <div class="list spaced">
                      ${savedStudyChoices
                        .map(
                          (choice) => `
                            <button class="list-item" data-action="saved-study-answer" data-answer="${escapeHtml(choice)}">
                              ${escapeHtml(choice)}
                            </button>
                          `
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }
              ${
                savedStudyReveal
                  ? `
                    <div class="detail-card spaced">
                      <p><strong>Source:</strong> ${escapeHtml(activeSavedStudy.sourceLessonTitle || activeSavedStudy.source || "manual")}</p>
                      <p class="muted">Bookmarked at ${escapeHtml(activeSavedStudy.bookmarkedAt || "unknown time")}</p>
                      <p class="muted">${escapeHtml(activeSavedStudy.example || (Array.isArray(activeSavedStudy.examples) ? activeSavedStudy.examples.join(" · ") : ""))}</p>
                    </div>
                  `
                  : `
                    <p class="muted">Reveal the card to see the saved context and source lesson.</p>
                  `
              }
              <div class="${feedbackClass(savedStudyFeedback || "Choose the meaning that matches the word or kanji.")}">${escapeHtml(savedStudyFeedback || (activeSavedStudy.kind === "word" ? "Choose the meaning that matches the word." : "Choose the meaning that matches the kanji."))}</div>
              <div class="button-row">
                <button class="secondary" data-action="saved-study-prev">Previous card</button>
                <button class="primary" data-action="saved-study-reveal">${savedStudyReveal ? "Hide details" : "Reveal details"}</button>
                <button class="secondary" data-action="saved-study-next">Next card</button>
              </div>
            `
            : "<p class='muted'>Save a word or kanji to build a personal review deck here.</p>"
        }
      </div>
      <div class="grid-card spaced">
        <h3>Kanji drill</h3>
        ${
          kanjiReview
            ? `
              <p class="muted">Quiz mode: choose the best meaning, then inspect readings and examples.</p>
              <div class="kanji-focus">
                <strong>${escapeHtml(kanjiReview.character)}</strong>
                <span class="tag">${escapeHtml(kanjiReview.meaning)}</span>
              </div>
              <p>${escapeHtml(kanjiReview.prompt)}</p>
              <div class="list">
                ${kanjiChoices
                  .map(
                    (choice) => `
                      <button class="list-item" data-action="kanji-quiz-answer" data-review-id="${escapeHtml(kanjiReview.id)}" data-answer="${escapeHtml(choice)}">
                        ${escapeHtml(choice)}
                      </button>
                    `
                  )
                  .join("")}
              </div>
              <div class="${feedbackClass(kanjiReviewFeedback || "Pick the meaning that matches the kanji.")}">${escapeHtml(kanjiReviewFeedback || "Pick the meaning that matches the kanji.")}</div>
              <div class="button-row">
                <button class="secondary" data-action="kanji-next-review">Next kanji</button>
                <button class="secondary" data-action="kanji-show-readings" data-character="${escapeHtml(kanjiReview.character)}">Show readings</button>
                <button class="secondary" data-action="toggle-kanji-bookmark" data-character="${escapeHtml(kanjiReview.character)}" data-meaning="${escapeHtml(kanjiReview.meaning ?? "")}" data-on-yomi="${escapeHtml(kanjiReview.onYomi ?? "")}" data-kun-yomi="${escapeHtml(kanjiReview.kunYomi ?? "")}" data-examples="${escapeHtml(JSON.stringify(kanjiReview.examples ?? []))}" data-source="review">${savedKanjiQueue.some((item) => item.character === kanjiReview.character) ? "Remove from saved" : "Save to review deck"}</button>
              </div>
              ${
                kanjiSelection && kanjiSelection.character === kanjiReview.character
                  ? `
                    <div class="spaced">
                      <p class="muted">Readings and examples</p>
                      <p>${escapeHtml(kanjiSelection.character)} · ${escapeHtml(kanjiSelection.meaning)}</p>
                      <p class="muted">${escapeHtml(kanjiSelection.onYomi || "No on-yomi stored")} / ${escapeHtml(kanjiSelection.kunYomi || "No kun-yomi stored")}</p>
                      <p>${escapeHtml((kanjiSelection.examples ?? []).slice(0, 3).join(" · ") || "No examples available.")}</p>
                    </div>
                  `
                  : ""
              }
            `
            : "<p class='muted'>No kanji review items available yet.</p>"
        }
      </div>
      <div class="grid-card spaced">
        <h3>Weekly challenges</h3>
        <div class="list">
          ${(state.admin.challenges ?? [])
            .map(
              (challenge) => `
                <div class="list-item">
                  <strong>${escapeHtml(challenge.title)}</strong>
                  <span class="muted">${escapeHtml(challenge.description)}</span>
                  <span class="muted">${challenge.progress}/${challenge.targetCount} · +${challenge.rewardXp} XP · +${challenge.rewardCredits} credits</span>
                  <div class="button-row">
                    ${
                      challenge.claimed
                        ? '<span class="tag">Claimed</span>'
                        : challenge.progress >= challenge.targetCount
                          ? `<button class="primary" data-action="claim-challenge" data-challenge-id="${escapeHtml(challenge.id)}">Claim reward</button>`
                          : '<span class="tag">In progress</span>'
                    }
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="review-grid">${items}</div>
    </section>
  `;
}

function renderProgress() {
  const savedWords = Array.isArray(state.progress.savedWords) ? state.progress.savedWords : [];
  const savedKanji = Array.isArray(state.progress.savedKanji) ? state.progress.savedKanji : [];
  const lessonNotes = state.progress.lessonNotes ?? {};
  const lessonNoteEntries = Object.entries(lessonNotes).filter(([, note]) => String(note ?? "").trim());
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Progress</p>
          <h2>Study streak, XP, and mastery</h2>
        </div>
        <p>SQLite-backed progress, streaks, achievements, and cosmetic ownership.</p>
      </div>
      <div class="stats-grid">
        ${renderStat("Kanji learned", state.progress.kanji)}
        ${renderStat("Vocabulary", state.progress.vocab)}
        ${renderStat("Speaking minutes", state.progress.speakingMinutes)}
        ${renderStat("Listening minutes", state.progress.listeningMinutes)}
        ${renderStat("Kanji drill items", state.kanjiReviews?.length ?? 0)}
        ${renderStat("Saved words", savedWords.length)}
        ${renderStat("Saved kanji", savedKanji.length)}
        ${renderStat("Lesson notes", lessonNoteEntries.length)}
        ${renderStat("Streak freezes", state.progress.streakFreezeCount ?? 0)}
      </div>
      <div class="progress-grid">
        <div class="grid-card">
          <h3>Daily tasks</h3>
          ${state.dailyTasks
            .map(
              (task) => `
                <div class="list-item">
                  ${task.complete ? "✓" : "○"} ${task.name}
                  <span class="muted">${task.reward}</span>
                  ${task.complete ? "" : `<button class="secondary" data-action="complete-task" data-task="${task.name}">Complete</button>`}
                </div>
              `
            )
            .join("")}
        </div>
        <div class="grid-card">
          <h3>Achievements</h3>
          ${state.achievements
            .map((achievement) => `<div class="list-item">${achievement.unlocked ? "🏆" : "◻"} ${achievement.name}</div>`)
            .join("")}
        </div>
        <div class="grid-card">
          <h3>Cosmetic shop</h3>
          ${state.cosmetics
            .map(
              (item) => `
                <div class="list-item">
                  ${item.equipped ? "Equipped" : item.owned ? "Owned" : `${item.cost} credits`} · ${item.name}
                  <div class="button-row">
                    ${item.owned && !item.equipped ? `<button class="secondary" data-action="equip-cosmetic" data-item="${item.name}">Equip</button>` : ""}
                    ${item.owned ? "" : `<button class="secondary" data-action="buy-cosmetic" data-item="${item.name}">Buy</button>`}
                  </div>
                </div>
              `
            )
            .join("")}
          <p class="muted spaced">Equipped: ${escapeHtml(state.cosmetics.find((item) => item.equipped)?.name ?? "None")}</p>
        </div>
        <div class="grid-card">
          <h3>Level progress</h3>
          <div class="meter"><span style="width: ${Math.min(100, (state.progress.xp % 1000) / 10)}%"></span></div>
          <p class="muted">${state.progress.xp % 1000}/1000 XP to the next level</p>
          <p>Completed lessons: ${state.progress.completedLessons.length}</p>
          <p>Reviewed words: ${state.progress.reviewedWords}</p>
          <p>Speaking sessions: ${state.progress.speakingSessions}</p>
        </div>
        <div class="grid-card">
          <h3>Streak shield</h3>
          <p class="muted">Use credits to stock a freeze token for missed study days.</p>
          <p>Freeze tokens: ${state.progress.streakFreezeCount ?? 0}</p>
          <p>Cost per token: 50 credits</p>
          <div class="button-row">
            <button class="secondary" data-action="buy-streak-freeze"${state.progress.credits < 50 ? " disabled" : ""}>Buy freeze</button>
          </div>
        </div>
        <div class="grid-card">
          <h3>Recent study sessions</h3>
          <div class="list">
            ${(state.admin.studySessions ?? [])
              .map(
                (session) => `
                  <div class="list-item">
                    <strong>${escapeHtml(session.kind)}</strong>
                    <span class="muted">${session.durationMinutes} min · ${session.xpDelta} XP · ${session.creditsDelta} credits</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card">
          <h3>Saved study deck</h3>
          <p class="muted">Quick access to bookmarked words and kanji from lessons and practice.</p>
          <div class="list">
            ${savedWords.length
              ? savedWords
                  .map(
                    (item) => `
                      <div class="list-item">
                        <div>
                          <strong>${escapeHtml(item.term)}</strong>
                          <span class="muted">${escapeHtml(item.reading || "—")} · ${escapeHtml(item.partOfSpeech || "—")}</span>
                          <span>${escapeHtml(item.meaning || "")}</span>
                        </div>
                        <div class="button-row">
                          <button class="secondary" data-action="lookup-word" data-term="${escapeHtml(item.term)}">Open</button>
                          <button class="secondary" data-action="toggle-word-bookmark" data-word="${escapeHtml(item.term)}" data-reading="${escapeHtml(item.reading ?? "")}" data-meaning="${escapeHtml(item.meaning ?? "")}" data-example="${escapeHtml(item.example ?? "")}" data-source="${escapeHtml(item.source ?? "manual")}">Remove</button>
                        </div>
                      </div>
                    `
                  )
                  .join("")
              : "<p class='muted'>No saved vocabulary yet.</p>"}
          </div>
          <div class="list spaced">
            ${savedKanji.length
              ? savedKanji
                  .map(
                    (item) => `
                      <div class="list-item">
                        <div>
                          <strong>${escapeHtml(item.character)}</strong>
                          <span class="muted">${escapeHtml(item.onYomi || "—")} / ${escapeHtml(item.kunYomi || "—")}</span>
                          <span>${escapeHtml(item.meaning || "")}</span>
                        </div>
                        <div class="button-row">
                          <button class="secondary" data-action="lookup-kanji" data-term="${escapeHtml(item.character)}">Open</button>
                          <button class="secondary" data-action="toggle-kanji-bookmark" data-character="${escapeHtml(item.character)}" data-meaning="${escapeHtml(item.meaning ?? "")}" data-on-yomi="${escapeHtml(item.onYomi ?? "")}" data-kun-yomi="${escapeHtml(item.kunYomi ?? "")}" data-examples="${escapeHtml(JSON.stringify(item.examples ?? []))}" data-source="${escapeHtml(item.source ?? "manual")}">Remove</button>
                        </div>
                      </div>
                    `
                  )
                  .join("")
              : "<p class='muted'>No saved kanji yet.</p>"}
          </div>
        </div>
        <div class="grid-card">
          <h3>Lesson notes</h3>
          <p class="muted">Your handwritten prompts and reminders, grouped by lesson.</p>
          <div class="list">
            ${lessonNoteEntries.length
              ? lessonNoteEntries
                  .map(([lessonId, note]) => {
                    const lesson = state.lessons.find((entry) => entry.id === lessonId);
                    return `
                      <div class="list-item">
                        <div>
                          <strong>${escapeHtml(lesson?.title ?? lessonId)}</strong>
                          <span class="muted">${escapeHtml(lesson?.theme ?? "custom")} · ${escapeHtml(lesson?.difficulty ?? "N5")}</span>
                          <span>${escapeHtml(note)}</span>
                        </div>
                        <div class="button-row">
                          <button class="secondary" data-action="select-lesson" data-id="${escapeHtml(lessonId)}">Open</button>
                          <button class="secondary" data-action="edit-lesson-note" data-lesson-id="${escapeHtml(lessonId)}">Edit</button>
                          <button class="secondary" data-action="save-lesson-note" data-lesson-id="${escapeHtml(lessonId)}" data-clear="true">Clear</button>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : "<p class='muted'>No lesson notes saved yet.</p>"}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSettings() {
  const aiRuntime = systemStatus?.aiRuntime ?? {};
  const speechStatus = systemStatus?.speech ?? {};
  const ttsStatus = systemStatus?.tts ?? {};
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Settings</p>
          <h2>Reading aids, audio helpers, and local runtime status</h2>
        </div>
        <p>Display controls are in the header. Content editing stays in Admin.</p>
      </div>
      <div class="settings-grid">
        <div class="grid-card">
          <h3>Reading aids</h3>
          <p class="muted">These are display preferences for the learner UI.</p>
          <ul class="feature-list">
            <li>Furigana: ${state.toggles.furigana ? "On" : "Off"}</li>
            <li>Romaji: ${state.toggles.romaji ? "On" : "Off"}</li>
            <li>Translation: ${state.toggles.translation ? "On" : "Off"}</li>
          </ul>
          <p class="muted">Use the header chips to switch them quickly while studying.</p>
        </div>
        <div class="grid-card">
          <h3>Local audio</h3>
          <p class="muted">Speaking and listening use browser audio first, then local system helpers when available.</p>
          <ul class="feature-list">
            <li>Speech-to-text: ${speechStatus.ready ? `Ready · ${escapeHtml(speechStatus.provider ?? "local")}` : "Fallback mode"}</li>
            <li>Text-to-speech: ${ttsStatus.ready ? `Ready · ${escapeHtml(ttsStatus.provider ?? "local")}` : "Fallback mode"}</li>
            <li>AI tutor: ${aiRuntime.ready ? `Ready · ${escapeHtml(aiRuntime.provider ?? "local")}` : "Fallback mode"}</li>
          </ul>
          <p class="muted">If one of these is not ready, the app still works. It uses the browser or a deterministic local helper.</p>
        </div>
        <div class="grid-card">
          <h3>Admin access</h3>
          <p class="muted">A local admin account is created on first start.</p>
          <ul class="feature-list">
            <li>Username: <code>admin</code></li>
            ${state.admin.defaultPassword
              ? `<li>Starter password: <code>fieldguide123</code>. Change it in Admin after signing in.</li>`
              : "<li>Password: changed from the starter one.</li>"}
            <li>Role: Super Admin</li>
          </ul>
        </div>
        <div class="grid-card">
          <h3>What settings are for</h3>
          <p class="muted">This tab is only for display and runtime preferences. It is not a lesson screen.</p>
          <ul class="feature-list">
            <li>Use Learn for lessons and dialogue scenes.</li>
            <li>Use Practice for speaking, listening, reading, and writing drills.</li>
            <li>Use Review for SRS cards and saved study items.</li>
            <li>Use Progress for streaks, rewards, and bookmarks.</li>
            <li>Use Admin for content, moderation, imports, and system tools.</li>
          </ul>
        </div>
      </div>
    </section>
  `;
}

function renderAdmin() {
  if (!state.admin.authenticated) {
    return `
      <section class="panel">
        <div class="section-title">
          <div>
            <p class="eyebrow">Admin</p>
            <h2>Sign in to manage content and settings</h2>
          </div>
          <p>SQLite-backed admin access is local-only for the MVP.</p>
        </div>
        <div class="grid-card">
          <label class="field">
            <span>Username</span>
            <input type="text" data-field="admin-username" value="admin" />
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" data-field="admin-password" autocomplete="current-password" />
          </label>
          <div class="button-row">
            <button class="primary" data-action="admin-login">Sign in</button>
          </div>
          ${state.admin.defaultPassword
            ? `<p class="muted">First time? Sign in with <code>admin</code> / <code>fieldguide123</code>, then change the password.</p>`
            : ""}
        </div>
      </section>
    `;
  }

  const lessonDraft = adminLessonEditor ?? buildLessonDraft("New Lesson", "custom");
  const kanjiDraft = adminKanjiEditor ?? buildKanjiEditorDraft();
  const kanjiEntries = Array.isArray(state.kanjiEntries) ? state.kanjiEntries : [];
  const users = adminUserDirectory ?? state.admin.users ?? [];
  const userDraft = adminUserEditor ?? {
    id: "",
    username: "",
    email: "",
    level: 1,
    status: "active",
    credits: 0,
    streak: 0,
  };
  const permissionState = permissionDraft ?? structuredClone(state.admin.permissions ?? { roles: [], permissions: [] });
  const availablePermissions = permissionState.permissions ?? [];
  const filteredModerationActions = filterModerationActions(state.admin.moderationActions ?? [], moderationFilters);

  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>Manage content, AI usage, and system health</h2>
        </div>
        <div class="button-row">
          <button class="secondary" data-action="admin-logout">Sign out</button>
        </div>
      </div>
      <div class="grid-card spaced password-card${state.admin.defaultPassword ? " is-warning" : ""}">
        <h3>${state.admin.defaultPassword ? "You're still using the starter password" : "Change admin password"}</h3>
        ${state.admin.defaultPassword
          ? `<p class="muted">Anyone who has read the README knows it. Pick a new one with at least 10 characters.</p>`
          : ""}
        <div class="field-row">
          <label class="field">
            <span>Current password</span>
            <input type="password" data-field="admin-current-password" autocomplete="current-password" />
          </label>
          <label class="field">
            <span>New password</span>
            <input type="password" data-field="admin-new-password" autocomplete="new-password" minlength="10" />
          </label>
        </div>
        <div class="button-row">
          <button class="primary" data-action="admin-change-password">Change password</button>
        </div>
        <p class="muted" data-output="admin-password-feedback">${escapeHtml(adminPasswordFeedback)}</p>
      </div>
      <div class="admin-grid">
        <div class="grid-card">
          <h3>Roles</h3>
          <div class="tag-row">${state.admin.roles.map((role) => `<span class="tag">${role}</span>`).join("")}</div>
          <h4 class="spaced">Permissions</h4>
          <div class="list">
            ${(permissionState.roles ?? [])
              .map(
                (role) => `
                  <div class="list-item">
                    <label class="field" style="width: 100%;">
                      <span>Role name</span>
                      <input type="text" data-field="role-name-${escapeHtml(role.id)}" value="${escapeHtml(role.name)}" />
                    </label>
                    <div class="tag-row">
                      ${availablePermissions
                        .map(
                          (permission) => `
                            <label class="tag" style="display: inline-flex; gap: 0.35rem; align-items: center;">
                              <input type="checkbox" data-field="role-permission-${escapeHtml(role.id)}-${escapeHtml(permission.id)}"${role.permissions.includes(permission.name) ? " checked" : ""} />
                              <span>${escapeHtml(permission.name)}</span>
                            </label>
                          `
                        )
                        .join("")}
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="button-row spaced">
            <button class="secondary" data-action="save-permissions">Save permissions</button>
            <button class="secondary" data-action="reload-permissions">Reset draft</button>
          </div>
        </div>
        <div class="grid-card">
          <h3>AI usage</h3>
          <p>Provider: ${escapeHtml(describeRuntimeMode(state.admin.aiUsage.provider, state.admin.aiUsage.ready))}${state.admin.aiUsage.ready ? ` · ${escapeHtml(state.admin.aiUsage.model ?? "llama3")} at ${escapeHtml(state.admin.aiUsage.host ?? "http://127.0.0.1:11434")}` : ""}</p>
          <p>Daily requests: ${state.admin.aiUsage.dailyRequests}</p>
          <p>Monthly requests: ${state.admin.aiUsage.monthlyRequests}</p>
          <p>Cached responses: ${state.admin.aiUsage.cachedResponses}</p>
          <p>Failed requests: ${state.admin.aiUsage.failedRequests}</p>
          <h4 class="spaced">AI playground</h4>
          <div class="field-row">
            <label class="field">
              <span>Feature</span>
              <select data-field="ai-playground-feature">
                ${["grammar", "tutor", "roleplay", "correction", "challenge-name", "badge-description", "lesson-draft"]
                  .map((feature) => `<option value="${feature}"${(adminAiPlayground?.feature ?? "grammar") === feature ? " selected" : ""}>${feature}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>Scenario</span>
              <input type="text" data-field="ai-playground-scenario" value="${escapeHtml(adminAiPlayground?.context?.scenario ?? "restaurant")}" placeholder="restaurant" />
            </label>
          </div>
          <label class="field">
            <span>Prompt</span>
            <textarea data-field="ai-playground-prompt" rows="4" placeholder="Ask about grammar, correction, or roleplay.">${escapeHtml(adminAiPlayground?.prompt ?? "Explain よろしくお願いします")}</textarea>
          </label>
          <div class="field-row">
            <label class="field">
              <span>Lesson title</span>
              <input type="text" data-field="ai-playground-title" value="${escapeHtml(adminAiPlayground?.context?.title ?? "Anime Dialogue")}" />
            </label>
            <label class="field">
              <span>Theme</span>
              <input type="text" data-field="ai-playground-theme" value="${escapeHtml(adminAiPlayground?.context?.theme ?? "anime")}" />
            </label>
          </div>
          <div class="button-row">
            <button class="secondary" data-action="run-ai-playground">Run playground</button>
          </div>
          ${adminAiPlayground ? `
            <div class="grid-card nested">
              <strong>${escapeHtml(adminAiPlayground.feature)}</strong>
              <p class="muted">Provider: ${escapeHtml(describeRuntimeMode(adminAiPlayground.provider, true))} ${adminAiPlayground.model ? `· ${escapeHtml(adminAiPlayground.model)}` : ""}</p>
              <pre class="code-block">${escapeHtml(adminAiPlayground.response ?? "")}</pre>
            </div>
          ` : ""}
        </div>
        <div class="grid-card">
          <h3>Runtime status</h3>
          <p>Database schema: ${systemStatus?.database?.schemaVersion ?? "unknown"}</p>
          <p>Applied migrations: ${(systemStatus?.database?.migrations ?? []).length}</p>
          <p>Dataset imports: ${systemStatus?.database?.imports ?? state.admin.datasetImports?.length ?? 0}</p>
          <p>Lessons: ${systemStatus?.database?.lessons ?? state.lessons.length} · Reviews: ${systemStatus?.database?.reviews ?? state.reviews.length}</p>
          <p>Kanji: ${systemStatus?.database?.kanjiEntries ?? state.kanjiEntries.length} · Kanji reviews: ${systemStatus?.database?.kanjiReviews ?? state.kanjiReviews.length}</p>
          <p>Users: ${systemStatus?.database?.users ?? state.admin.users.length}</p>
          <p>AI: ${escapeHtml(describeRuntimeMode(systemStatus?.aiRuntime?.provider ?? state.admin.aiUsage.provider, Boolean(systemStatus?.aiRuntime?.ready ?? state.admin.aiUsage.ready)))} ${systemStatus?.aiRuntime?.ready ? `· ${escapeHtml(systemStatus.aiRuntime.model ?? "")}` : "· local helper"}</p>
          <p>Speech: ${systemStatus?.speech?.available ? `available (${escapeHtml(systemStatus.speech.provider ?? "whisper")})` : "unavailable"}</p>
          <p>TTS: ${systemStatus?.tts?.available ? `available (${escapeHtml(systemStatus.tts.provider ?? "browser")})` : "unavailable"}</p>
          <p>Maintenance: ${systemStatus?.maintenanceMode ? "On" : "Off"}</p>
          ${(systemStatus?.database?.migrations ?? []).length ? `
            <div class="tag-row spaced">
              ${(systemStatus.database.migrations ?? []).map((migration) => `<span class="tag">v${escapeHtml(migration.version)} · ${escapeHtml(String(migration.applied_at).slice(0, 10))}</span>`).join("")}
            </div>
          ` : ""}
          ${!systemStatus?.aiRuntime?.ready || !systemStatus?.speech?.available || !systemStatus?.tts?.available ? `
            <p class="muted spaced">Setup hints</p>
            <ul class="feature-list">
              ${!systemStatus?.aiRuntime?.ready ? "<li>Start Ollama or a local OpenAI-compatible server and set <code>AI_PROVIDER=ollama</code> or <code>AI_PROVIDER=openai-compatible</code>.</li>" : ""}
              ${!systemStatus?.speech?.available ? "<li>Install Whisper and set <code>WHISPER_BIN</code> plus <code>WHISPER_MODEL</code>.</li>" : ""}
              ${!systemStatus?.tts?.available ? "<li>Configure <code>TTS_PROVIDER=say</code> or <code>TTS_PROVIDER=espeak</code>.</li>" : ""}
            </ul>
          ` : ""}
        </div>
        <div class="grid-card">
          <h3>Analytics</h3>
          <p>${state.admin.analytics?.xpEvents ?? 0} XP events · ${state.admin.analytics?.xpAwarded ?? 0} XP awarded</p>
          <p>${state.admin.analytics?.creditEvents ?? 0} credit events · ${state.admin.analytics?.creditsAwarded ?? 0} credits awarded</p>
          <p>${state.admin.analytics?.studySessions ?? 0} study sessions · ${state.admin.analytics?.studyMinutes ?? 0} minutes</p>
          <p>${state.admin.analytics?.reviewHistory ?? 0} review events · ${state.admin.analytics?.kanjiReviewHistory ?? 0} kanji review events</p>
          <p>${state.admin.analytics?.aiRequests ?? 0} AI requests · ${state.admin.analytics?.aiCacheHits ?? 0} cache hits</p>
          <p>${state.kanjiEntries?.length ?? 0} kanji entries · ${state.kanjiReviews?.length ?? 0} kanji drills</p>
          <p>${state.admin.analytics?.topLessons?.length ?? 0} lesson-linked review groups · ${state.admin.analytics?.topKanji?.length ?? 0} trending kanji</p>
          ${renderBarChart("Top study kinds", state.admin.analytics?.sessionKinds ?? [], (item) => item.kind, (item) => item.count, (item) => `${item.count} sessions · ${item.durationMinutes} min`, "No study sessions yet.")}
          ${renderBarChart("AI requests by day", state.admin.analytics?.dailyAi ?? [], (item) => item.dateKey, (item) => item.count, (item) => `${item.count} requests`, "No AI usage yet.")}
          ${renderBarChart("Top kanji", state.admin.analytics?.topKanji ?? [], (item) => item.character, (item) => item.reviewCount, (item) => `${item.reviewCount} reviews`, "No kanji reviews yet.")}
          ${renderBarChart("Moderation status", state.admin.analytics?.moderationStatus ?? [], (item) => item.status, (item) => item.count, (item) => `${item.count} actions`, "No moderation actions yet.")}
          ${renderBarChart("Moderation types", state.admin.analytics?.moderationTypes ?? [], (item) => item.itemType, (item) => item.count, (item) => `${item.count} actions`, "No moderation types yet.")}
          ${renderBarChart("Moderators", state.admin.analytics?.moderationReviewers ?? [], (item) => item.reviewer, (item) => item.count, (item) => `${item.count} actions`, "No moderator activity yet.")}
          ${renderBarChart("Import sources", state.admin.analytics?.importSources ?? [], (item) => item.sourceType, (item) => item.count, (item) => `${item.count} imports`, "No imports yet.")}
        </div>
        <div class="grid-card">
          <h3>Site health</h3>
          <p class="${state.admin.siteHealth === "Green" ? "muted" : ""}">Status: ${state.admin.siteHealth}</p>
          <p>Maintenance mode, content review, and analytics hooks are managed from the SQLite-backed admin layer.</p>
          <button class="secondary" data-action="toggle-maintenance">Toggle maintenance</button>
        </div>
        <div class="grid-card">
          <h3>Import registry</h3>
          <p class="muted">Recent bulk imports and their counts.</p>
          <div class="list">
            ${(state.admin.datasetImports ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <div>
                      <strong>${escapeHtml(item.label)}</strong>
                      <span class="muted">${escapeHtml(item.sourceType)} · ${escapeHtml(String(item.createdAt).slice(0, 10))}</span>
                      <span>${escapeHtml(Object.entries(item.counts ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No counts")}</span>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card">
          <h3>Site settings</h3>
          <p>Maintenance: ${state.admin.maintenanceMode ? "On" : "Off"}</p>
          <p>Announcement: ${escapeHtml(state.admin.announcements)}</p>
          <label class="field">
            <span>New announcement</span>
            <input type="text" data-field="announcement-input" value="${escapeHtml(state.admin.announcements)}" />
          </label>
          <button class="primary" data-action="save-announcement">Save announcement</button>
          <h4 class="spaced">Backup / restore</h4>
          <label class="field">
            <span>Snapshot JSON</span>
            <textarea data-field="backup-json" rows="8" placeholder="Exported snapshot appears here."></textarea>
          </label>
          <div class="button-row">
            <button class="secondary" data-action="export-backup">Export backup</button>
            <button class="secondary" data-action="import-backup">Import backup</button>
          </div>
        </div>
        <div class="grid-card">
          <h3>Content management</h3>
          <div class="list">
            ${state.lessons
              .map(
                (lesson) => `
                  <div class="list-item">
                    <div>
                      <strong>${escapeHtml(lesson.title)}</strong>
                      <span class="muted">${escapeHtml(lesson.theme)} · ${escapeHtml(lesson.difficulty)}</span>
                    </div>
                    <div class="button-row">
                      <button class="secondary" data-action="edit-lesson" data-lesson-id="${escapeHtml(lesson.id)}">Edit</button>
                      <button class="secondary" data-action="delete-lesson" data-lesson-id="${escapeHtml(lesson.id)}">Delete</button>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <h4 class="spaced">${adminLessonEditor ? "Edit lesson" : "Create lesson"}</h4>
          <label class="field">
            <span>Title</span>
            <input type="text" data-field="lesson-title" value="${escapeHtml(lessonDraft.title)}" placeholder="Travel: Train Station" />
          </label>
          <label class="field">
            <span>Theme</span>
            <input type="text" data-field="lesson-theme" value="${escapeHtml(lessonDraft.theme)}" placeholder="travel" />
          </label>
          <label class="field">
            <span>Difficulty</span>
            <input type="text" data-field="lesson-difficulty" value="${escapeHtml(lessonDraft.difficulty)}" placeholder="N5" />
          </label>
          <label class="field">
            <span>Japanese</span>
            <input type="text" data-field="lesson-japanese" value="${escapeHtml(lessonDraft.japanese)}" placeholder="きょうは新しい表現を学びます。" />
          </label>
          <label class="field">
            <span>Romaji</span>
            <input type="text" data-field="lesson-romaji" value="${escapeHtml(lessonDraft.romaji)}" placeholder="Kyou wa atarashii hyougen o manabimasu." />
          </label>
          <label class="field">
            <span>Translation</span>
            <input type="text" data-field="lesson-translation" value="${escapeHtml(lessonDraft.translation)}" placeholder="Today we are learning a new expression." />
          </label>
          <label class="field">
            <span>Grammar</span>
            <input type="text" data-field="lesson-grammar" value="${escapeHtml(lessonDraft.grammar)}" placeholder="Custom lesson created from the admin panel." />
          </label>
          <label class="field">
            <span>Grammar points JSON</span>
            <textarea data-field="lesson-grammar-points" rows="4" placeholder='[{"title":"Core grammar","explanation":"Explain the point.","example":"今日はよろしくお願いします。"}]'>${escapeHtml(JSON.stringify(lessonDraft.grammarPoints ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Dialogue lines JSON</span>
            <textarea data-field="lesson-dialogue-lines" rows="5" placeholder='[{"speaker":"Narration","text":"Scene setup."},{"speaker":"Speaker A","text":"こんにちは。"},{"speaker":"Speaker B","text":"こんばんは。"}]'>${escapeHtml(JSON.stringify(lessonDraft.dialogueLines ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Exercises JSON</span>
            <textarea data-field="lesson-exercises" rows="5" placeholder='[{"type":"multiple-choice","prompt":"Which meaning best fits?","choices":["A","B"],"answer":"A","explanation":"Why A is correct."}]'>${escapeHtml(JSON.stringify(lessonDraft.exercises ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Scenes JSON</span>
            <textarea data-field="lesson-scenes" rows="6" placeholder='[{"title":"Opening","setting":"Anime opening","summary":"Set the scene.","lines":[{"speaker":"Narration","text":"..."},{"speaker":"Hero","text":"..."}],"references":["..."]}]'>${escapeHtml(JSON.stringify(lessonDraft.scenes ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Media JSON</span>
            <textarea data-field="lesson-media" rows="4" placeholder='[{"type":"reference","title":"Context card","caption":"Text reference for the scene","alt":"Lesson reference","source":"anime","uri":"","license":"local","sceneIndex":0,"orderIndex":0}]'>${escapeHtml(JSON.stringify(lessonDraft.media ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Pop culture notes JSON</span>
            <textarea data-field="lesson-pop-culture-notes" rows="4" placeholder='[{"title":"Episode framing","context":"Why this line feels like anime.","reference":"..."}]'>${escapeHtml(JSON.stringify(lessonDraft.popCultureNotes ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Kanji breakdowns JSON</span>
            <textarea data-field="lesson-kanji-breakdowns" rows="6" placeholder='[{"character":"駅","meaning":"station","onYomi":"エキ","kunYomi":"","components":"馬 + 尺","mnemonic":"...","examples":["駅はどこですか。"],"lessonContext":"Travel"}]'>${escapeHtml(JSON.stringify(lessonDraft.kanjiBreakdowns ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Lesson goals JSON</span>
            <textarea data-field="lesson-goals" rows="4" placeholder='["Complete the scene","Answer every exercise","Save a note"]'>${escapeHtml(JSON.stringify(lessonDraft.lessonGoals ?? [], null, 2))}</textarea>
          </label>
          <label class="field">
            <span>Reference tags JSON</span>
            <textarea data-field="lesson-reference-tags" rows="3" placeholder='["travel","station","N5"]'>${escapeHtml(JSON.stringify(lessonDraft.referenceTags ?? [], null, 2))}</textarea>
          </label>
          <div class="grid-card nested spaced">
            <h4>Kanji editor</h4>
            <p class="muted">Edit a single kanji entry with structured fields, then save it back through the same upsert path used by imports.</p>
            <div class="field-row">
              <label class="field">
                <span>Character</span>
                <input type="text" data-field="kanji-character" value="${escapeHtml(kanjiDraft.character)}" placeholder="駅" />
              </label>
              <label class="field">
                <span>Meaning</span>
                <input type="text" data-field="kanji-meaning" value="${escapeHtml(kanjiDraft.meaning)}" placeholder="station" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>On-yomi</span>
                <input type="text" data-field="kanji-on-yomi" value="${escapeHtml(kanjiDraft.onYomi)}" placeholder="エキ" />
              </label>
              <label class="field">
                <span>Kun-yomi</span>
                <input type="text" data-field="kanji-kun-yomi" value="${escapeHtml(kanjiDraft.kunYomi)}" placeholder="うまや" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Group name</span>
                <input type="text" data-field="kanji-group-name" value="${escapeHtml(kanjiDraft.groupName)}" placeholder="transit" />
              </label>
              <label class="field">
                <span>Difficulty</span>
                <input type="text" data-field="kanji-difficulty" value="${escapeHtml(kanjiDraft.difficulty)}" placeholder="N5" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Stroke count</span>
                <input type="number" min="0" data-field="kanji-stroke-count" value="${escapeHtml(String(kanjiDraft.strokeCount ?? 0))}" />
              </label>
              <label class="field">
                <span>Stroke order source</span>
                <input type="text" data-field="kanji-stroke-order-source" value="${escapeHtml(kanjiDraft.strokeOrderSource)}" placeholder="lesson-derived" />
              </label>
            </div>
            <label class="field">
              <span>Examples</span>
              <textarea data-field="kanji-examples" rows="3" placeholder="駅はどこですか。&#10;電車が来ます。">${escapeHtml((kanjiDraft.examples ?? []).join("\n"))}</textarea>
            </label>
            <label class="field">
              <span>Radicals</span>
              <textarea data-field="kanji-radicals" rows="2" placeholder="馬&#10;尺">${escapeHtml((kanjiDraft.radicals ?? []).join("\n"))}</textarea>
            </label>
            <label class="field">
              <span>Related kanji</span>
              <textarea data-field="kanji-related" rows="2" placeholder="電&#10;通">${escapeHtml((kanjiDraft.relatedKanji ?? []).join("\n"))}</textarea>
            </label>
            <div class="button-row">
              <button class="primary" data-action="save-kanji">${adminKanjiEditor ? "Save kanji" : "Add kanji"}</button>
              <button class="secondary" data-action="new-kanji">New kanji</button>
              ${adminKanjiEditor ? '<button class="secondary" data-action="cancel-kanji-edit">Cancel edit</button>' : ""}
            </div>
            <div class="list">
              ${kanjiEntries.slice(0, 8).map((entry) => `
                <div class="list-item">
                  <div>
                    <strong>${escapeHtml(entry.character)}</strong>
                    <span class="muted">${escapeHtml(entry.meaning)} · ${escapeHtml(entry.groupName || entry.group || "—")} · ${escapeHtml(entry.difficulty || "—")}</span>
                    <span class="muted">${escapeHtml(entry.onYomi || "—")} / ${escapeHtml(entry.kunYomi || "—")} · ${escapeHtml(String(entry.strokeCount ?? 0))} strokes</span>
                  </div>
                  <div class="button-row">
                    <button class="secondary" data-action="edit-kanji" data-kanji-character="${escapeHtml(entry.character)}">Edit</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="field-row">
            <label class="field">
              <span>Pack title</span>
              <input type="text" data-field="lesson-pack-title" value="${escapeHtml(lessonDraft.title)}" placeholder="Anime Pack" />
            </label>
            <label class="field">
              <span>Pack count</span>
              <input type="number" min="1" max="6" data-field="lesson-pack-count" value="3" />
            </label>
          </div>
          <label class="field">
            <span>Import lesson JSON</span>
            <textarea
              data-field="lesson-import-json"
              rows="5"
              placeholder='[{"title":"Anime: Convenience Store","theme":"anime","difficulty":"N5","japanese":"いらっしゃいませ。","romaji":"Irasshaimase.","translation":"Welcome.","grammar":"Greeting used by shop staff."}]'
            ></textarea>
          </label>
          <p class="muted">Paste one lesson object or an array of lesson objects, then import them into SQLite.</p>
          <label class="field">
            <span>Review note</span>
            <textarea data-field="content-review-note" rows="3" placeholder="Why should this lesson be reviewed?"></textarea>
          </label>
          <label class="field">
            <span>Dictionary JSON</span>
            <textarea
              data-field="dictionary-import-json"
              rows="5"
              placeholder='[{"term":"ありがとう","reading":"ありがとう","meaning":"thank you","partOfSpeech":"expression","example":"ありがとう。"}]'
            ></textarea>
          </label>
          <div class="button-row">
            <button class="secondary" data-action="import-dictionary">Import dictionary</button>
          </div>
          <label class="field spaced">
            <span>Kanji JSON</span>
            <textarea
              data-field="kanji-import-json"
              rows="5"
              placeholder='[{"character":"駅","meaning":"station","onYomi":"エキ","kunYomi":"","examples":["駅はどこですか。"],"radicals":["馬","尺"],"strokeCount":14,"strokeOrderSource":"lesson-derived","groupName":"transit","difficulty":"N5","relatedKanji":["電","通"]}]'
            ></textarea>
          </label>
          <div class="button-row">
            <button class="secondary" data-action="import-kanji">Import kanji</button>
          </div>
          <label class="field spaced">
            <span>Review JSON</span>
            <textarea
              data-field="review-import-json"
              rows="5"
              placeholder='[{"prompt":"一つ","answer":"ひとつ","meaning":"one item","due":"Now","ease":2.5,"interval_days":1,"repetitions":0,"mistakes":0,"source_lesson_id":"anime-intro"}]'
            ></textarea>
          </label>
          <div class="button-row">
            <button class="secondary" data-action="import-reviews">Import reviews</button>
          </div>
          <label class="field spaced">
            <span>Dataset bundle JSON</span>
            <input type="file" accept=".json,.xml,.txt" data-field="dataset-import-file" />
            <input type="url" data-field="dataset-import-url" placeholder="https://example.com/JMdict.xml" />
            <textarea
              data-field="dataset-import-json"
              rows="6"
              placeholder='Paste JSON or raw JMdict/KANJIDIC XML here.'
            ></textarea>
          </label>
          <p class="muted">Use a file, a URL, or paste JSON/raw JMdict/KANJIDIC XML. Bundle imports expand them into dictionary, kanji, lesson, and review tables and keep the source file name or URL in the registry.</p>
          <div class="button-row">
            <button class="secondary" data-action="import-dataset">Import dataset bundle</button>
            <button class="secondary" data-action="import-dataset-url">Import dataset URL</button>
          </div>
          <h4 class="spaced">Recent imports</h4>
          <div class="list">
            ${(state.admin.datasetImports ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <div>
                      <strong>${escapeHtml(item.label)}</strong>
                      <span class="muted">${escapeHtml(item.sourceType)} · ${escapeHtml(String(item.createdAt).slice(0, 10))}</span>
                      ${item.sourceUri ? `<span class="muted">${escapeHtml(item.sourceUri)}</span>` : ""}
                      <span>${escapeHtml(Object.entries(item.counts ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No counts")}</span>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <h4 class="spaced">Content review queue</h4>
          <div class="list">
            ${(state.admin.contentReviewQueue ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <div>
                      <strong>${escapeHtml(item.itemType)}</strong>
                      <span class="muted">${escapeHtml(item.status)} · ${escapeHtml(item.source ?? "seed")} · ${escapeHtml(item.notes)}</span>
                      <span class="muted">Reason: ${escapeHtml(item.decisionReason || "n/a")} · Reviewer: ${escapeHtml(item.reviewedBy || "n/a")} · Reviewed: ${escapeHtml(item.reviewedAt || "n/a")}</span>
                    </div>
                    <div class="button-row">
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="draft">Draft</button>
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="pending">Pending</button>
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="published">Publish</button>
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="archived">Archive</button>
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="rejected">Reject</button>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <h4 class="spaced">Moderation history</h4>
          <div class="grid-card nested">
            <div class="field-row">
              <label class="field">
                <span>Query</span>
                <input type="text" data-field="moderation-filter-query" value="${escapeHtml(moderationFilters.query)}" placeholder="lesson, audit, review" />
              </label>
              <label class="field">
                <span>Status</span>
                <input type="text" data-field="moderation-filter-status" value="${escapeHtml(moderationFilters.status)}" placeholder="published" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Type</span>
                <input type="text" data-field="moderation-filter-type" value="${escapeHtml(moderationFilters.itemType)}" placeholder="lesson" />
              </label>
              <label class="field">
                <span>Reviewer</span>
                <input type="text" data-field="moderation-filter-reviewer" value="${escapeHtml(moderationFilters.reviewer)}" placeholder="admin" />
              </label>
            </div>
          <div class="button-row">
            <button class="primary" data-action="apply-moderation-filters">Apply filters</button>
            <button class="secondary" data-action="clear-moderation-filters">Clear</button>
            <button class="secondary" data-action="export-moderation-history">Export JSON</button>
          </div>
          <label class="field spaced">
            <span>Import moderation JSON</span>
            <textarea data-field="moderation-import-json" rows="5" placeholder='[{"queueItemId":"content-review-1","itemType":"lesson","itemId":"anime-intro","status":"published","decisionReason":"Ready","reviewedBy":"admin","notes":"Imported from another install"}]'></textarea>
          </label>
          <div class="button-row">
            <button class="secondary" data-action="import-moderation-history">Import moderation JSON</button>
          </div>
          </div>
          <div class="list">
            ${(filteredModerationActions ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <div>
                      <strong>${escapeHtml(item.itemType)}</strong>
                      <span class="muted">${escapeHtml(item.status)} · ${escapeHtml(item.itemId)} · ${escapeHtml(String(item.reviewedAt || item.createdAt || "").slice(0, 19).replace("T", " "))}</span>
                      <span class="muted">Reviewer: ${escapeHtml(item.reviewedBy || "n/a")} · Reason: ${escapeHtml(item.decisionReason || "n/a")}</span>
                      <span>${escapeHtml(item.notes || "")}</span>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="button-row spaced">
            <button class="primary" data-action="save-lesson">${adminLessonEditor ? "Save changes" : "Add lesson"}</button>
            <button class="secondary" data-action="generate-lesson-draft">Generate draft</button>
            <button class="secondary" data-action="generate-lesson-pack">Generate pack</button>
            <button class="secondary" data-action="import-lessons">Import JSON</button>
            <button class="secondary" data-action="import-kanji">Import kanji</button>
            <button class="secondary" data-action="import-reviews">Import reviews</button>
            <button class="secondary" data-action="queue-content-review">Queue review</button>
            ${adminLessonEditor ? '<button class="secondary" data-action="cancel-lesson-edit">Cancel edit</button>' : ""}
          </div>
        </div>
        <div class="grid-card">
          <h3>User management</h3>
          <div class="grid-card nested">
            <h4>Search users</h4>
            <div class="field-row">
              <label class="field">
                <span>Username</span>
                <input type="text" data-field="user-filter-username" value="${escapeHtml(adminUserFilters.username)}" />
              </label>
              <label class="field">
                <span>Email</span>
                <input type="text" data-field="user-filter-email" value="${escapeHtml(adminUserFilters.email)}" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Status</span>
                <input type="text" data-field="user-filter-status" value="${escapeHtml(adminUserFilters.status)}" placeholder="active" />
              </label>
              <label class="field">
                <span>Level</span>
                <input type="text" data-field="user-filter-level" value="${escapeHtml(adminUserFilters.level)}" placeholder="8" />
              </label>
            </div>
            <div class="button-row">
              <button class="primary" data-action="search-users">Search</button>
              <button class="secondary" data-action="clear-user-filters">Clear</button>
            </div>
          </div>
          <div class="list">
            ${users
              .map(
                (user) => `
                  <div class="list-item">
                    <strong>${escapeHtml(user.username)}</strong>
                    <span class="muted">${escapeHtml(user.email)} · Level ${user.level} · ${escapeHtml(user.status)}</span>
                    <span class="muted">Credits: ${user.credits} · Streak: ${user.streak}</span>
                    <div class="button-row">
                      <button class="secondary" data-action="edit-user" data-user-id="${escapeHtml(user.id)}">Edit</button>
                      <button class="secondary" data-action="toggle-user-status" data-user-id="${escapeHtml(user.id)}" data-status="${user.status === "active" ? "suspended" : "active"}">${user.status === "active" ? "Suspend" : "Restore"}</button>
                      <button class="secondary" data-action="adjust-user-credits" data-user-id="${escapeHtml(user.id)}" data-delta="25">+25 credits</button>
                      <button class="secondary" data-action="adjust-user-credits" data-user-id="${escapeHtml(user.id)}" data-delta="-25">-25 credits</button>
                      <button class="secondary" data-action="delete-user" data-user-id="${escapeHtml(user.id)}">Delete</button>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <h4 class="spaced">${adminUserEditor ? "Edit user" : "Create user"}</h4>
          <label class="field">
            <span>Username</span>
            <input type="text" data-field="user-username" value="${escapeHtml(userDraft.username)}" placeholder="akira" />
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" data-field="user-email" value="${escapeHtml(userDraft.email)}" placeholder="akira@example.com" />
          </label>
          <div class="field-row">
            <label class="field">
              <span>Level</span>
              <input type="number" min="1" data-field="user-level" value="${escapeHtml(userDraft.level)}" />
            </label>
            <label class="field">
              <span>Status</span>
              <input type="text" data-field="user-status" value="${escapeHtml(userDraft.status)}" placeholder="active" />
            </label>
          </div>
          <div class="field-row">
            <label class="field">
              <span>Credits</span>
              <input type="number" min="0" data-field="user-credits" value="${escapeHtml(userDraft.credits)}" />
            </label>
            <label class="field">
              <span>Streak</span>
              <input type="number" min="0" data-field="user-streak" value="${escapeHtml(userDraft.streak)}" />
            </label>
          </div>
          <div class="button-row spaced">
            <button class="primary" data-action="save-user">${adminUserEditor ? "Save changes" : "Add user"}</button>
            ${adminUserEditor ? '<button class="secondary" data-action="cancel-user-edit">Cancel edit</button>' : ""}
          </div>
          <div class="button-row spaced">
            <button class="secondary" data-action="reset-database">Reset database</button>
          </div>
        </div>
        <div class="grid-card">
          <h3>Audit log</h3>
          <div class="list">
            ${state.admin.auditLog.map((item) => `<div class="list-item">${escapeHtml(item)}</div>`).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}


function lessonStepAttr(step) {
  return `data-step="${step}"${lessonStep === step ? "" : " hidden"}`;
}

function renderLessonSteps() {
  return `
    <div class="lesson-steps" role="tablist" aria-label="Lesson steps">
      ${LESSON_STEPS.map((step, index) => `
        <button class="lesson-step${lessonStep === step.id ? " active" : ""}" role="tab" aria-selected="${lessonStep === step.id}" data-lesson-step="${step.id}">
          <span class="lesson-step-index">${index + 1}</span>${icon(step.icon)}<span>${step.label}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderLessonStepFooter(lessonId) {
  const index = LESSON_STEPS.findIndex((step) => step.id === lessonStep);
  const prev = LESSON_STEPS[index - 1];
  const next = LESSON_STEPS[index + 1];
  return `
    <div class="lesson-step-footer">
      ${prev ? `<button class="secondary" data-lesson-step="${prev.id}">${icon("left")}<span>${prev.label}</span></button>` : "<span></span>"}
      ${next
        ? `<button class="primary" data-lesson-step="${next.id}"><span>Next: ${next.label}</span>${icon("right")}</button>`
        : `<button class="primary" data-action="complete-lesson" data-id="${escapeHtml(lessonId)}">Complete lesson</button>`}
    </div>
  `;
}

function renderStat(label, value) {
  const STAT_ICONS = {
    XP: "zap",
    Level: "trophy",
    Credits: "coins",
    Streak: "flame",
    "Kanji learned": "graduation",
    Vocabulary: "book",
    "Speaking minutes": "mic",
    "Listening minutes": "headphones",
    "Kanji drill items": "layers",
    "Saved words": "bookmark",
    "Saved kanji": "bookmark",
    "Lesson notes": "notePlus",
    "Streak freezes": "snow",
  };
  return `
    <div class="stat">
      ${STAT_ICONS[label] ? `<span class="stat-icon" data-icon="${STAT_ICONS[label]}">${icon(STAT_ICONS[label])}</span>` : ""}
      <strong>${value}</strong>
      <span class="muted">${label}</span>
    </div>
  `;
}

function buildBarChartRows(items, labelFn, valueFn, limit = 5) {
  const rows = (Array.isArray(items) ? items : []).slice(0, Math.max(1, limit)).map((item) => ({
    item,
    label: String(labelFn(item) ?? ""),
    value: Number(valueFn(item) ?? 0),
  }));
  const max = Math.max(1, ...rows.map((row) => row.value));
  return rows.map((row) => ({
    ...row,
    width: Math.max(8, Math.round((row.value / max) * 100)),
  }));
}

function renderBarChart(title, items, labelFn, valueFn, detailFn, emptyMessage = "No data yet.") {
  const rows = buildBarChartRows(items, labelFn, valueFn, 6);
  return `
    <div class="grid-card nested spaced">
      <h4>${escapeHtml(title)}</h4>
      ${
        rows.length
          ? `
            <div class="chart-list">
              ${rows
                .map(
                  (row, index) => `
                    <div class="chart-row">
                      <span class="chart-index">${index + 1}</span>
                      <span class="chart-label">${escapeHtml(row.label)}</span>
                      <div class="meter chart-meter"><span style="width: ${row.width}%"></span></div>
                      <span class="muted chart-detail">${escapeHtml(detailFn?.(row.item) ?? `${row.value}`)}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : `<p class="muted">${escapeHtml(emptyMessage)}</p>`
      }
    </div>
  `;
}

function practiceCard(title, description, steps, body = "") {
  return `
    <article class="grid-card">
      <p class="tag">${title}</p>
      <p>${description}</p>
      <div class="tag-row">${steps.map((step) => `<span class="tag">${step}</span>`).join("")}</div>
      ${body}
    </article>
  `;
}

function buildSavedStudyChoices(activeItem, wordDeck = [], kanjiDeck = [], reviewDeck = [], kanjiReviewDeck = [], lessons = []) {
  const correct = activeItem?.kind === "kanji"
    ? String(activeItem.meaning || activeItem.display || "").trim()
    : String(activeItem.meaning || "").trim();
  const distractors = new Set();
  const addMeaning = (value) => {
    const text = String(value ?? "").trim();
    if (text && text !== correct) distractors.add(text);
  };

  [...wordDeck, ...reviewDeck]
    .slice(0, 10)
    .forEach((item) => addMeaning(item.meaning ?? item.answer ?? item.translation));
  [...kanjiDeck, ...kanjiReviewDeck]
    .slice(0, 10)
    .forEach((item) => addMeaning(item.meaning ?? item.answer));
  (Array.isArray(lessons) ? lessons : [])
    .slice(0, 5)
    .forEach((lesson) => {
      addMeaning(lesson.translation);
      addMeaning(lesson.grammar);
    });

  const choices = [correct, ...Array.from(distractors).filter(Boolean)].filter(Boolean).slice(0, 4);
  while (choices.length < 4) {
    choices.push(choices[choices.length - 1] || correct || "—");
  }
  return Array.from(new Set(choices));
}

// One click listener on the app container handles every button, so a re-render
// no longer has to attach hundreds of fresh listeners.
app.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-lesson-step]");
  if (stepButton && app.contains(stepButton)) {
    selectLessonStep(stepButton);
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button || !app.contains(button)) return;
  const card = button.closest(".grid-card, .detail-card, form") ?? app;
  consumedFields = new Set(Array.from(card.querySelectorAll("[data-field]"), (field) => field.dataset.field));
  handleAction(button);
});

function selectLessonStep(button) {
      lessonStep = button.dataset.lessonStep;
      render();
      document.querySelector("#featured-lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const strip = document.querySelector(".lesson-steps");
      const active = strip?.querySelector(".lesson-step.active");
      if (strip && active) strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2;
}

async function handleAction(button) {
  const action = button.dataset.action;
  if (action === "select-lesson") {
    state.activeLessonId = button.dataset.id;
    lessonExerciseIndex = 0;
    lessonExerciseFeedback = "";
    lessonExerciseDraftAnswer = "";
    lessonExerciseResult = null;
    lessonDialogueIndex = 0;
    lessonSceneIndex = 0;
    lessonStep = "overview";
    persist();
    render();
    document.querySelector("#featured-lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (action === "complete-lesson") {
    const lessonId = button.dataset.id;
    if (lessonId) {
      await apiJson("/api/progress/lesson-complete", {
        method: "POST",
        body: { lessonId },
      });
      await refreshState();
    }
  }

  if (action === "speak-lesson") {
    const lesson = state.lessons.find((entry) => entry.id === button.dataset.id);
    if (lesson) {
      void speakText(lesson.japanese);
    }
  }

  if (action === "select-lesson-scene") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const scenes = Array.isArray(activeLesson?.scenes) ? activeLesson.scenes : [];
    if (scenes.length) {
      lessonSceneIndex = Number(button.dataset.index ?? 0) % scenes.length;
      lessonDialogueIndex = 0;
    }
    render();
  }

  if (action === "dialogue-prev" || action === "dialogue-next") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const scenes = Array.isArray(activeLesson?.scenes) && activeLesson.scenes.length ? activeLesson.scenes : [];
    const sceneLines = scenes.length ? scenes[lessonSceneIndex % scenes.length]?.lines ?? [] : [];
    const lines = sceneLines.length
      ? sceneLines
      : Array.isArray(activeLesson?.dialogueLines) && activeLesson.dialogueLines.length
        ? activeLesson.dialogueLines
        : [];
    if (lines.length) {
      if (action === "dialogue-prev") {
        lessonDialogueIndex = (lessonDialogueIndex - 1 + lines.length) % lines.length;
      } else {
        lessonDialogueIndex = (lessonDialogueIndex + 1) % lines.length;
      }
    }
    render();
  }

  if (action === "scene-prev" || action === "scene-next") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const scenes = Array.isArray(activeLesson?.scenes) ? activeLesson.scenes : [];
    if (scenes.length) {
      if (action === "scene-prev") {
        lessonSceneIndex = (lessonSceneIndex - 1 + scenes.length) % scenes.length;
      } else {
        lessonSceneIndex = (lessonSceneIndex + 1) % scenes.length;
      }
      lessonDialogueIndex = 0;
    }
    render();
  }

  if (action === "select-dialogue-line") {
    const index = Number(button.dataset.index ?? 0);
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const scenes = Array.isArray(activeLesson?.scenes) && activeLesson.scenes.length ? activeLesson.scenes : [];
    const sceneLines = scenes.length ? scenes[lessonSceneIndex % scenes.length]?.lines ?? [] : [];
    const lines = sceneLines.length
      ? sceneLines
      : Array.isArray(activeLesson?.dialogueLines) && activeLesson.dialogueLines.length
        ? activeLesson.dialogueLines
        : [];
    if (lines.length) {
      lessonDialogueIndex = index % lines.length;
    }
    render();
  }

  if (action === "speak-dialogue-line") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const scenes = Array.isArray(activeLesson?.scenes) && activeLesson.scenes.length ? activeLesson.scenes : [];
    const sceneLines = scenes.length ? scenes[lessonSceneIndex % scenes.length]?.lines ?? [] : [];
    const lines = sceneLines.length
      ? sceneLines
      : Array.isArray(activeLesson?.dialogueLines) && activeLesson.dialogueLines.length
        ? activeLesson.dialogueLines
        : [];
    const line = lines.length ? lines[lessonDialogueIndex % lines.length] : null;
    if (line?.text) {
      void speakText(line.text);
    }
  }

  if (action === "explain-grammar") {
    const lesson = state.lessons.find((entry) => entry.id === button.dataset.id);
    const output = app.querySelector('[data-output="grammar-feedback"]');
    if (lesson && output) {
      const result = await apiJson("/api/ai/response", {
        method: "POST",
        body: {
          feature: "grammar",
          prompt: lesson.grammar,
          context: { lessonTitle: lesson.title, lessonId: lesson.id },
        },
      });
      output.textContent = result.response ?? lesson.grammar;
    }
  }

  if (action === "lesson-exercise-prev" || action === "lesson-exercise-next") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const exerciseCount = Array.isArray(activeLesson?.exercises) ? activeLesson.exercises.length : 0;
    if (exerciseCount > 0) {
      if (action === "lesson-exercise-prev") {
        lessonExerciseIndex = (lessonExerciseIndex - 1 + exerciseCount) % exerciseCount;
      } else {
        lessonExerciseIndex = (lessonExerciseIndex + 1) % exerciseCount;
      }
    }
    lessonExerciseFeedback = "";
    lessonExerciseDraftAnswer = "";
    lessonExerciseResult = null;
    render();
  }

  if (action === "lesson-exercise-answer") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const exercises = Array.isArray(activeLesson?.exercises) ? activeLesson.exercises : [];
    const exercise = exercises[lessonExerciseIndex % Math.max(exercises.length, 1)];
    if (!exercise) return;
    lessonExerciseDraftAnswer = button.dataset.choice ?? "";
    const result = await apiJson("/api/practice", {
      method: "POST",
      body: {
        kind: "lesson-exercise",
        lessonId: activeLesson.id,
        exerciseKey: button.dataset.exerciseKey ?? exercise.id ?? `${activeLesson.id}-exercise-${lessonExerciseIndex + 1}`,
        exercise,
        selected: lessonExerciseDraftAnswer,
      },
    });
    lessonExerciseFeedback = result.tutor?.answer ?? lessonExerciseFeedback;
    lessonExerciseResult = {
      exerciseKey: button.dataset.exerciseKey ?? exercise.id ?? `${activeLesson.id}-exercise-${lessonExerciseIndex + 1}`,
      selected: lessonExerciseDraftAnswer,
      answer: result.exercise?.answer ?? exercise.answer ?? "",
      correct: Boolean(result.exercise?.correct ?? result.correct ?? false),
    };
    if (result.progress?.completedExercises?.includes(button.dataset.exerciseKey ?? exercise.id)) {
      lessonExerciseIndex = (lessonExerciseIndex + 1) % Math.max(exercises.length, 1);
      lessonExerciseResult = null;
    }
    await refreshState();
  }

  if (action === "lesson-exercise-submit") {
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const exercises = Array.isArray(activeLesson?.exercises) ? activeLesson.exercises : [];
    const exercise = exercises[lessonExerciseIndex % Math.max(exercises.length, 1)];
    if (!exercise) return;
    const input = app.querySelector('[data-field="lesson-exercise-input"]');
    const answer = input?.value ?? lessonExerciseDraftAnswer ?? "";
    lessonExerciseDraftAnswer = answer;
    const result = await apiJson("/api/practice", {
      method: "POST",
      body: {
        kind: "lesson-exercise",
        lessonId: activeLesson.id,
        exerciseKey: button.dataset.exerciseKey ?? exercise.id ?? `${activeLesson.id}-exercise-${lessonExerciseIndex + 1}`,
        exercise,
        input: answer,
      },
    });
    lessonExerciseFeedback = result.tutor?.answer ?? lessonExerciseFeedback;
    lessonExerciseResult = {
      exerciseKey: button.dataset.exerciseKey ?? exercise.id ?? `${activeLesson.id}-exercise-${lessonExerciseIndex + 1}`,
      selected: answer,
      answer: result.exercise?.answer ?? exercise.answer ?? "",
      correct: Boolean(result.exercise?.correct ?? result.correct ?? false),
    };
    if (result.progress?.completedExercises?.includes(button.dataset.exerciseKey ?? exercise.id)) {
      lessonExerciseIndex = (lessonExerciseIndex + 1) % Math.max(exercises.length, 1);
      lessonExerciseDraftAnswer = "";
      lessonExerciseResult = null;
    }
    await refreshState();
  }

  if (action === "transcribe-speaking") {
    const transcriptOutput = app.querySelector('[data-output="transcription-feedback"]');
    const speakingInput = app.querySelector('[data-field="speaking-input"]');
    const recognition = createSpeechRecognition();
    if (recognition) {
      let handled = false;
      const useFallback = async (reason = "speech recognition unavailable") => {
        if (handled) return;
        handled = true;
        const result = await recordSpeechFallback(speakingInput?.value ?? "", transcriptOutput);
        if (speakingInput && result.transcript) speakingInput.value = result.transcript;
        if (transcriptOutput && reason) {
          transcriptOutput.textContent = transcriptOutput.textContent.includes("Transcript") ? transcriptOutput.textContent : `${reason}. Using the reference sentence.`;
        }
      };
      if (transcriptOutput) transcriptOutput.textContent = "Listening for speech...";
      recognition.onresult = (event) => {
        if (handled) return;
        handled = true;
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (transcriptOutput) transcriptOutput.textContent = `Transcript: ${transcript || "No speech detected."}`;
        if (speakingInput && transcript) speakingInput.value = transcript;
      };
      recognition.onerror = () => useFallback("Speech recognition failed");
      recognition.onend = () => {
        if (!handled) useFallback("Speech recognition ended without a result");
      };
      recognition.start();
      return;
    }

    const result = await recordSpeechFallback(speakingInput?.value ?? "", transcriptOutput);
    if (speakingInput && result.transcript) speakingInput.value = result.transcript;
  }

  if (action === "open-feature") {
    state.view = "practice";
    persist();
    render();
  }

  if (action === "open-roleplay") {
    state.view = "practice";
    persist();
    render();
  }

  if (action === "continue-lesson") {
    const lessonId = button.dataset.id ?? findNextLessonId(state.lessons, state.progress.completedLessons, state.activeLessonId);
    if (lessonId) {
      state.activeLessonId = lessonId;
      state.view = "learn";
      lessonExerciseIndex = 0;
      lessonExerciseFeedback = "";
      lessonExerciseDraftAnswer = "";
      lessonExerciseResult = null;
      lessonDialogueIndex = 0;
      lessonSceneIndex = 0;
      lessonStep = "overview";
      persist();
      render();
      document.querySelector("#featured-lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (action === "apply-lesson-filters") {
    const query = app.querySelector('[data-field="lesson-filter-query"]');
    const theme = app.querySelector('[data-field="lesson-filter-theme"]');
    const difficulty = app.querySelector('[data-field="lesson-filter-difficulty"]');
    lessonCatalogQuery = query?.value?.trim() ?? "";
    lessonCatalogTheme = theme?.value?.trim() ?? "";
    lessonCatalogDifficulty = difficulty?.value?.trim() ?? "";
    render();
  }

  if (action === "clear-lesson-filters") {
    lessonCatalogQuery = "";
    lessonCatalogTheme = "";
    lessonCatalogDifficulty = "";
    render();
  }

  if (action === "apply-moderation-filters") {
    const query = app.querySelector('[data-field="moderation-filter-query"]');
    const status = app.querySelector('[data-field="moderation-filter-status"]');
    const itemType = app.querySelector('[data-field="moderation-filter-type"]');
    const reviewer = app.querySelector('[data-field="moderation-filter-reviewer"]');
    moderationFilters = {
      query: query?.value?.trim() ?? "",
      status: status?.value?.trim() ?? "",
      itemType: itemType?.value?.trim() ?? "",
      reviewer: reviewer?.value?.trim() ?? "",
    };
    render();
  }

  if (action === "clear-moderation-filters") {
    moderationFilters = {
      query: "",
      status: "",
      itemType: "",
      reviewer: "",
    };
    render();
  }

  if (action === "grade-review") {
    const reviewId = button.dataset.reviewId;
    const grade = Number(button.dataset.grade ?? 4);
    if (reviewId) {
      await apiJson(`/api/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        body: { grade },
      });
      if (grade >= 4) {
        await apiJson("/api/gamification/award", {
          method: "POST",
          body: { source: "review-pass", delta: { xp: grade === 5 ? 24 : 20, credits: grade === 5 ? 6 : 5, streak: 0 } },
        });
      }
      reviewReveal = false;
      const count = (state.reviews ?? []).length;
      reviewDeckIndex = count ? (reviewDeckIndex + 1) % count : 0;
      await refreshState();
    }
  }

  if (action === "review-reveal-card") {
    reviewReveal = !reviewReveal;
    render();
  }

  if (action === "review-next-card" || action === "review-prev-card") {
    const count = (state.reviews ?? []).length;
    if (count) {
      reviewDeckIndex = action === "review-next-card"
        ? (reviewDeckIndex + 1) % count
        : (reviewDeckIndex - 1 + count) % count;
    }
    reviewReveal = false;
    render();
  }

  if (action === "saved-study-mode") {
    savedStudyMode = button.dataset.mode ?? "all";
    savedStudyIndex = 0;
    savedStudyReveal = false;
    savedStudyFeedback = "";
    render();
  }

  if (action === "saved-study-prev" || action === "saved-study-next") {
    const savedWordQueue = (state.progress.savedWords ?? []).map((item) => ({ ...item, kind: "word" }));
    const savedKanjiQueue = (state.progress.savedKanji ?? []).map((item) => ({ ...item, kind: "kanji" }));
    const deck = savedStudyMode === "words"
      ? savedWordQueue
      : savedStudyMode === "kanji"
        ? savedKanjiQueue
        : [...savedWordQueue, ...savedKanjiQueue];
    if (deck.length) {
      savedStudyIndex = action === "saved-study-next"
        ? (savedStudyIndex + 1) % deck.length
        : (savedStudyIndex - 1 + deck.length) % deck.length;
    }
    savedStudyReveal = false;
    savedStudyFeedback = "";
    render();
  }

  if (action === "saved-study-reveal") {
    savedStudyReveal = !savedStudyReveal;
    render();
  }

  if (action === "saved-study-answer") {
    const savedWordQueue = (state.progress.savedWords ?? []).map((item) => ({ ...item, kind: "word", display: item.term }));
    const savedKanjiQueue = (state.progress.savedKanji ?? []).map((item) => ({ ...item, kind: "kanji", display: item.character }));
    const deck = savedStudyMode === "words"
      ? savedWordQueue
      : savedStudyMode === "kanji"
        ? savedKanjiQueue
        : [...savedWordQueue, ...savedKanjiQueue];
    const active = deck.length ? deck[savedStudyIndex % deck.length] : null;
    const correct = active?.kind === "kanji" ? String(active.meaning || active.display || "") : String(active?.meaning || "");
    const selected = String(button.dataset.answer ?? "");
    const isCorrect = selected === correct;
    savedStudyFeedback = isCorrect
      ? `Correct. ${active?.display || "This item"} means ${correct}.`
      : `Not quite. ${active?.display || "This item"} means ${correct}.`;
    savedStudyReveal = true;
    if (isCorrect) {
      await apiJson("/api/gamification/award", {
        method: "POST",
        body: { source: "saved-study-pass", delta: { xp: 12, credits: 3, streak: 0 } },
      });
      await apiJson("/api/study-sessions", {
        method: "POST",
        body: { kind: "saved-study", durationMinutes: 4, xpDelta: 12, creditsDelta: 3 },
      });
      await refreshState();
    } else {
      render();
    }
  }

  if (action === "kanji-quiz-answer") {
    const reviewId = button.dataset.reviewId;
    const answer = button.dataset.answer ?? "";
    const kanjiReview = (state.kanjiReviews ?? []).find((entry) => entry.id === reviewId);
    if (reviewId && kanjiReview) {
      const correct = answer === kanjiReview.meaning;
      const grade = correct ? 4 : 2;
      await apiJson(`/api/kanji/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        body: { grade },
      });
      if (correct) {
        await apiJson("/api/gamification/award", {
          method: "POST",
          body: { source: "kanji-review-pass", delta: { xp: 18, credits: 4, streak: 0 } },
        });
        kanjiReviewFeedback = `Correct. ${kanjiReview.character} means ${kanjiReview.meaning}.`;
      } else {
        kanjiReviewFeedback = `Not quite. ${kanjiReview.character} means ${kanjiReview.meaning}.`;
      }
      kanjiReviewIndex = 0;
      await refreshState();
    }
  }

  if (action === "kanji-next-review") {
    const count = (state.kanjiReviews ?? []).length;
    kanjiReviewIndex = count ? (kanjiReviewIndex + 1) % count : 0;
    kanjiReviewFeedback = "";
    render();
  }

  if (action === "kanji-show-readings") {
    const character = button.dataset.character ?? "";
    const deck = Array.isArray(state.kanjiEntries) ? state.kanjiEntries : [];
    kanjiSelection = deck.find((entry) => entry.character === character)
      ?? state.kanjiReviews?.find((entry) => entry.character === character)
      ?? null;
    const deckIndex = deck.findIndex((entry) => entry.character === character);
    if (deckIndex >= 0) {
      kanjiStudyIndex = deckIndex;
      kanjiStudyExampleIndex = 0;
    }
    render();
  }

  if (action === "check-speaking") {
    const input = app.querySelector('[data-field="speaking-input"]');
    const output = app.querySelector('[data-output="speaking-feedback"]');
    const prompt = speakingPrompts[speakingPromptIndex % speakingPrompts.length]?.reference ?? "";
    const next = await apiJson("/api/practice", {
      method: "POST",
      body: { kind: "speaking", input: input?.value ?? "", prompt },
    });
    setFeedbackNode(output, next.tutor?.answer ?? state.tutor.answer);
    await refreshState();
  }

  if (action === "speaking-starter") {
    const input = app.querySelector('[data-field="speaking-input"]');
    if (input) {
      input.value = button.dataset.value ?? "ラーメンをください。";
      input.focus();
    }
  }

  if (action === "next-speaking") {
    speakingPromptIndex = (speakingPromptIndex + 1) % speakingPrompts.length;
    render();
  }

  if (action === "play-sample") {
    void speakText("ラーメンをください。");
  }

  if (action === "listening-answer") {
    const output = app.querySelector('[data-output="listening-feedback"]');
    const answer = button.dataset.answer ?? "";
    const answerKey = button.dataset.answerKey ?? "";
    const prompt = button.dataset.prompt ?? "the listening prompt";
    await apiJson("/api/practice", {
      method: "POST",
      body: { kind: "listening", answer, answerKey, prompt },
    });
    setFeedbackNode(output, answer === answerKey ? `Correct. ${prompt}.` : `Not quite. ${prompt}.`);
    await refreshState();
  }

  if (action === "replay-listening") {
    const scenario = listeningScenarios[listeningScenarioIndex % listeningScenarios.length];
    void speakText(scenario.question);
  }

  if (action === "next-listening") {
    listeningScenarioIndex = (listeningScenarioIndex + 1) % listeningScenarios.length;
    render();
  }

  if (action === "check-writing") {
    const input = app.querySelector('[data-field="writing-input"]');
    const output = app.querySelector('[data-output="writing-feedback"]');
    const result = await apiJson("/api/practice", {
      method: "POST",
      body: { kind: "writing", input: input?.value ?? "" },
    });
    setFeedbackNode(output, result.tutor?.answer ?? state.tutor.answer);
    await refreshState();
  }

  if (action === "writing-starter") {
    const input = app.querySelector('[data-field="writing-input"]');
    if (input) {
      input.value = button.dataset.value ?? "私は毎日日本語を勉強します。";
      input.focus();
    }
  }

  if (action === "ask-tutor") {
    const input = app.querySelector('[data-field="tutor-input"]');
    const output = app.querySelector('[data-output="tutor-feedback"]');
    const next = await apiJson("/api/practice", {
      method: "POST",
      body: { kind: "tutor", question: input?.value ?? state.tutor.question },
    });
    setFeedbackNode(output, next.tutor?.answer ?? state.tutor.answer);
    await refreshState();
  }

  if (action === "send-roleplay") {
    const select = app.querySelector('[data-field="roleplay-scenario"]');
    const input = app.querySelector('[data-field="roleplay-input"]');
    const scenario = select?.value ?? "restaurant";
    roleplayDraft = input?.value ?? roleplayDraft;
    await apiJson("/api/practice", {
      method: "POST",
      body: { kind: "roleplay", scenario, input: roleplayDraft },
    });
    roleplayDraft = "";
    await refreshState();
  }

  if (action === "roleplay-reset") {
    roleplayDraft = "";
    const active = app.querySelector('[data-field="roleplay-input"]');
    if (active) active.value = "";
    await apiJson("/api/practice", {
      method: "POST",
      body: { kind: "roleplay", scenario: app.querySelector('[data-field="roleplay-scenario"]')?.value ?? "restaurant" },
    });
    await refreshState();
  }

  if (action === "lookup-word") {
    const term = button.dataset.term ?? "";
    dictionaryLookup = await apiJson(`/api/dictionary?query=${encodeURIComponent(term)}`);
    readingSelection = dictionaryLookup[0] ?? null;
    render();
  }

  if (action === "toggle-word-bookmark") {
    await apiJson("/api/progress/bookmarks", {
      method: "POST",
      body: {
        kind: "word",
        item: {
          word: button.dataset.word ?? "",
          term: button.dataset.word ?? "",
          reading: button.dataset.reading ?? "",
          kana: button.dataset.reading ?? "",
          meaning: button.dataset.meaning ?? "",
          example: button.dataset.example ?? "",
          source: button.dataset.source ?? "manual",
          sourceLessonId: button.dataset.sourceLessonId ?? "",
          sourceLessonTitle: button.dataset.sourceLessonTitle ?? "",
        },
      },
    });
    await refreshState();
  }

  if (action === "lookup-kanji") {
    const term = button.dataset.term ?? "";
    const deck = Array.isArray(state.kanjiEntries) ? state.kanjiEntries : [];
    kanjiSelection = deck.find((entry) => entry.character === term)
      ?? state.kanjiReviews?.find((entry) => entry.character === term)
      ?? null;
    const deckIndex = deck.findIndex((entry) => entry.character === term);
    if (deckIndex >= 0) {
      kanjiStudyIndex = deckIndex;
      kanjiStudyExampleIndex = 0;
    }
    render();
  }

  if (action === "toggle-kanji-bookmark") {
    let examples = [];
    try {
      examples = JSON.parse(button.dataset.examples ?? "[]");
    } catch {
      examples = [];
    }
    await apiJson("/api/progress/bookmarks", {
      method: "POST",
      body: {
        kind: "kanji",
        item: {
          character: button.dataset.character ?? "",
          meaning: button.dataset.meaning ?? "",
          onYomi: button.dataset.onYomi ?? "",
          kunYomi: button.dataset.kunYomi ?? "",
          examples,
          source: button.dataset.source ?? "manual",
          sourceLessonId: button.dataset.sourceLessonId ?? "",
          sourceLessonTitle: button.dataset.sourceLessonTitle ?? "",
        },
      },
    });
    await refreshState();
  }

  if (action === "save-lesson-note") {
    const lessonId = button.dataset.lessonId ?? state.activeLessonId;
    const input = app.querySelector('[data-field="lesson-note-input"]');
    const note = button.dataset.clear === "true" ? "" : (input?.value ?? "");
    const result = await apiJson("/api/progress/lesson-note", {
      method: "POST",
      body: { lessonId, note },
    });
    lessonNoteFeedback = result?.lessonNotes?.[lessonId] ? "Lesson note saved." : "Lesson note cleared.";
    await refreshState();
  }

  if (action === "append-lesson-note") {
    const lessonId = button.dataset.lessonId ?? state.activeLessonId;
    const input = app.querySelector('[data-field="lesson-note-input"]');
    if (input) {
      const snippet = button.dataset.snippet ?? "";
      const current = input.value.trim();
      input.value = current ? `${current}\n${snippet}` : snippet;
      lessonNoteFeedback = `Added a snippet for ${lessonId}.`;
      input.focus();
    }
    render();
  }

  if (action === "edit-lesson-note") {
    const lessonId = button.dataset.lessonId ?? state.activeLessonId;
    state.activeLessonId = lessonId;
    lessonNoteFeedback = "Editing lesson note.";
    persist();
    render();
  }

  if (action === "fill-lesson-note") {
    const input = app.querySelector('[data-field="lesson-note-input"]');
    const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
    const prefix = button.dataset.value ?? "Note:";
    if (input) {
      const current = input.value.trim();
      const line = activeLesson
        ? `${prefix} ${activeLesson.title} · ${activeLesson.theme}`
        : `${prefix} `;
      input.value = current ? `${current}\n${line}` : line;
      input.focus();
    }
  }

  if (action === "lookup-dictionary") {
    const input = app.querySelector('[data-field="dictionary-input"]');
    const term = input?.value?.trim() ?? "";
    dictionaryLookup = term ? await apiJson(`/api/dictionary?query=${encodeURIComponent(term)}`) : [];
    readingSelection = dictionaryLookup[0] ?? null;
    render();
  }

  if (action === "clear-dictionary") {
    dictionaryLookup = [];
    readingSelection = null;
    kanjiSelection = null;
    render();
  }

  if (action === "kanji-study-next" || action === "kanji-study-prev" || action === "kanji-study-example") {
    const deck = Array.isArray(state.kanjiEntries) ? state.kanjiEntries : [];
    if (deck.length) {
      if (action === "kanji-study-next") {
        kanjiStudyIndex = (kanjiStudyIndex + 1) % deck.length;
        kanjiStudyExampleIndex = 0;
      } else if (action === "kanji-study-prev") {
        kanjiStudyIndex = (kanjiStudyIndex - 1 + deck.length) % deck.length;
        kanjiStudyExampleIndex = 0;
      } else {
        const entry = deck[kanjiStudyIndex % deck.length];
        const exampleCount = Array.isArray(entry?.examples) ? entry.examples.filter(Boolean).length : 0;
        kanjiStudyExampleIndex = exampleCount ? (kanjiStudyExampleIndex + 1) % exampleCount : 0;
      }
      kanjiSelection = deck[kanjiStudyIndex % deck.length] ?? kanjiSelection;
    }
    render();
  }

  if (action === "claim-challenge") {
    const challengeId = button.dataset.challengeId;
    if (challengeId) {
      await apiJson(`/api/challenges/${encodeURIComponent(challengeId)}/claim`, { method: "POST" });
      await refreshState();
    }
  }

  if (action === "open-chest") {
    const result = await apiJson("/api/gamification/chest", { method: "POST" });
    state.chest.lastReward = result.reward ?? state.chest.lastReward;
    await refreshState();
  }

  if (action === "complete-task") {
    const task = state.dailyTasks.find((entry) => entry.name === button.dataset.task);
    if (task && !task.complete) {
      await apiJson("/api/progress/task-complete", {
        method: "POST",
        body: { taskId: task.id ?? task.name },
      });
      await refreshState();
    }
  }

  if (action === "buy-streak-freeze") {
    if (state.progress.credits >= 50) {
      await apiJson("/api/gamification/streak-freeze", { method: "POST" });
      await refreshState();
    }
  }

  if (action === "buy-cosmetic") {
    const cosmetic = state.cosmetics.find((entry) => entry.name === button.dataset.item);
    if (cosmetic && !cosmetic.owned && state.progress.credits >= cosmetic.cost) {
      await apiJson("/api/cosmetics/buy", {
        method: "POST",
        body: { cosmeticId: cosmetic.id ?? cosmetic.name },
      });
      await refreshState();
    }
  }

  if (action === "equip-cosmetic") {
    const cosmetic = state.cosmetics.find((entry) => entry.name === button.dataset.item);
    if (cosmetic && cosmetic.owned && !cosmetic.equipped) {
      await apiJson("/api/cosmetics/equip", {
        method: "POST",
        body: { cosmeticId: cosmetic.id ?? cosmetic.name },
      });
      await refreshState();
    }
  }

  if (action === "toggle-maintenance") {
    const next = await apiJson("/api/settings", {
      method: "PATCH",
      body: {
        maintenanceMode: !state.admin.maintenanceMode,
        announcements: state.admin.announcements,
      },
    });
    state.admin.maintenanceMode = next.maintenanceMode;
    state.admin.siteHealth = next.maintenanceMode ? "Amber" : "Green";
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Maintenance mode ${state.admin.maintenanceMode ? "enabled" : "disabled"}` },
    });
    await refreshState();
  }

  if (action === "save-announcement") {
    const input = app.querySelector('[data-field="announcement-input"]');
    const next = await apiJson("/api/settings", {
      method: "PATCH",
      body: {
        announcements: input?.value ?? state.admin.announcements,
        maintenanceMode: state.admin.maintenanceMode,
      },
    });
    state.admin.announcements = next.announcements;
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: "Updated homepage announcement" },
    });
    await refreshState();
  }

  if (action === "edit-lesson") {
    const lessonId = button.dataset.lessonId;
    const lesson = state.lessons.find((entry) => entry.id === lessonId);
    if (lesson) {
      adminLessonEditor = structuredClone(lesson);
      render();
    }
  }

  if (action === "cancel-lesson-edit") {
    adminLessonEditor = null;
    render();
  }

  if (action === "edit-kanji") {
    const character = button.dataset.kanjiCharacter;
    const kanji = state.kanjiEntries.find((entry) => entry.character === character);
    if (kanji) {
      adminKanjiEditor = buildKanjiEditorDraft(kanji);
      render();
    }
  }

  if (action === "new-kanji") {
    adminKanjiEditor = buildKanjiEditorDraft();
    render();
  }

  if (action === "cancel-kanji-edit") {
    adminKanjiEditor = null;
    render();
  }

  if (action === "save-lesson") {
    const titleInput = app.querySelector('[data-field="lesson-title"]');
    const themeInput = app.querySelector('[data-field="lesson-theme"]');
    const difficultyInput = app.querySelector('[data-field="lesson-difficulty"]');
    const japaneseInput = app.querySelector('[data-field="lesson-japanese"]');
    const romajiInput = app.querySelector('[data-field="lesson-romaji"]');
    const translationInput = app.querySelector('[data-field="lesson-translation"]');
    const grammarInput = app.querySelector('[data-field="lesson-grammar"]');
    const grammarPointsInput = app.querySelector('[data-field="lesson-grammar-points"]');
    const dialogueLinesInput = app.querySelector('[data-field="lesson-dialogue-lines"]');
    const exercisesInput = app.querySelector('[data-field="lesson-exercises"]');
    const scenesInput = app.querySelector('[data-field="lesson-scenes"]');
    const mediaInput = app.querySelector('[data-field="lesson-media"]');
    const popCultureNotesInput = app.querySelector('[data-field="lesson-pop-culture-notes"]');
    const kanjiBreakdownsInput = app.querySelector('[data-field="lesson-kanji-breakdowns"]');
    const lessonGoalsInput = app.querySelector('[data-field="lesson-goals"]');
    const referenceTagsInput = app.querySelector('[data-field="lesson-reference-tags"]');
    const title = titleInput?.value?.trim();
    if (!title && !adminLessonEditor) {
      return;
    }
    const theme = themeInput?.value?.trim() || adminLessonEditor?.theme || "custom";
    const baseLesson = buildLesson(title || adminLessonEditor?.title || "New Lesson", theme);
    const parseCollection = (value, fallback) => {
      if (!value) return fallback;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    };
    const payload = {
      ...baseLesson,
      id: adminLessonEditor?.id ?? baseLesson.id,
      title: title || adminLessonEditor?.title || baseLesson.title,
      theme,
      difficulty: difficultyInput?.value?.trim() || adminLessonEditor?.difficulty || baseLesson.difficulty,
      japanese: japaneseInput?.value?.trim() || adminLessonEditor?.japanese || baseLesson.japanese,
      romaji: romajiInput?.value?.trim() || adminLessonEditor?.romaji || baseLesson.romaji,
      translation: translationInput?.value?.trim() || adminLessonEditor?.translation || baseLesson.translation,
      grammar: grammarInput?.value?.trim() || adminLessonEditor?.grammar || baseLesson.grammar,
      grammarPoints: parseCollection(grammarPointsInput?.value, adminLessonEditor?.grammarPoints ?? baseLesson.grammarPoints),
      dialogueLines: parseCollection(dialogueLinesInput?.value, adminLessonEditor?.dialogueLines ?? baseLesson.dialogueLines),
      exercises: parseCollection(exercisesInput?.value, adminLessonEditor?.exercises ?? baseLesson.exercises),
      scenes: parseCollection(scenesInput?.value, adminLessonEditor?.scenes ?? baseLesson.scenes),
      media: parseCollection(mediaInput?.value, adminLessonEditor?.media ?? baseLesson.media),
      popCultureNotes: parseCollection(popCultureNotesInput?.value, adminLessonEditor?.popCultureNotes ?? baseLesson.popCultureNotes),
      kanjiBreakdowns: parseCollection(kanjiBreakdownsInput?.value, adminLessonEditor?.kanjiBreakdowns ?? baseLesson.kanjiBreakdowns),
      lessonGoals: parseCollection(lessonGoalsInput?.value, adminLessonEditor?.lessonGoals ?? baseLesson.lessonGoals),
      referenceTags: parseCollection(referenceTagsInput?.value, adminLessonEditor?.referenceTags ?? baseLesson.referenceTags),
    };
    if (adminLessonEditor?.id) {
      await apiJson(`/api/lessons/${encodeURIComponent(adminLessonEditor.id)}`, {
        method: "PATCH",
        body: payload,
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Updated lesson: ${payload.title}` },
      });
    } else {
      await apiJson("/api/lessons", {
        method: "POST",
        body: payload,
      });
      await apiJson("/api/gamification/award", {
        method: "POST",
        body: { source: "lesson-create", delta: { xp: 25, credits: 0, streak: 0 } },
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Added lesson: ${payload.title}` },
      });
    }
    adminLessonEditor = null;
    await refreshState();
  }

  if (action === "save-kanji") {
    const wasEditing = Boolean(adminKanjiEditor?.id);
    const characterInput = app.querySelector('[data-field="kanji-character"]');
    const meaningInput = app.querySelector('[data-field="kanji-meaning"]');
    const onYomiInput = app.querySelector('[data-field="kanji-on-yomi"]');
    const kunYomiInput = app.querySelector('[data-field="kanji-kun-yomi"]');
    const groupNameInput = app.querySelector('[data-field="kanji-group-name"]');
    const difficultyInput = app.querySelector('[data-field="kanji-difficulty"]');
    const strokeCountInput = app.querySelector('[data-field="kanji-stroke-count"]');
    const strokeOrderSourceInput = app.querySelector('[data-field="kanji-stroke-order-source"]');
    const examplesInput = app.querySelector('[data-field="kanji-examples"]');
    const radicalsInput = app.querySelector('[data-field="kanji-radicals"]');
    const relatedInput = app.querySelector('[data-field="kanji-related"]');
    const character = characterInput?.value?.trim();
    if (!character) {
      window.alert("Enter a kanji character before saving.");
      return;
    }
    const payload = {
      id: adminKanjiEditor?.id ?? `kanji-${character}`,
      character,
      meaning: meaningInput?.value?.trim() || character,
      onYomi: onYomiInput?.value?.trim() || "",
      kunYomi: kunYomiInput?.value?.trim() || "",
      examples: parseLineList(examplesInput?.value, adminKanjiEditor?.examples ?? []),
      radicals: parseLineList(radicalsInput?.value, adminKanjiEditor?.radicals ?? []),
      strokeCount: Number(strokeCountInput?.value ?? adminKanjiEditor?.strokeCount ?? 0) || 0,
      strokeOrderSource: strokeOrderSourceInput?.value?.trim() || adminKanjiEditor?.strokeOrderSource || "",
      groupName: groupNameInput?.value?.trim() || adminKanjiEditor?.groupName || "",
      difficulty: difficultyInput?.value?.trim() || adminKanjiEditor?.difficulty || "N5",
      relatedKanji: parseLineList(relatedInput?.value, adminKanjiEditor?.relatedKanji ?? []),
      source: adminKanjiEditor?.source ?? "manual",
    };
    await apiJson("/api/kanji/import", {
      method: "POST",
      body: { entries: [payload] },
    });
    adminKanjiEditor = null;
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `${wasEditing ? "Updated" : "Added"} kanji entry: ${payload.character}` },
    });
    await refreshState();
  }

  if (action === "generate-lesson-draft") {
    const titleInput = app.querySelector('[data-field="lesson-title"]');
    const themeInput = app.querySelector('[data-field="lesson-theme"]');
    const title = titleInput?.value?.trim() || "New Lesson";
    const theme = themeInput?.value?.trim() || adminLessonEditor?.theme || "travel";
    adminLessonEditor = buildLessonDraft(title, theme);
    render();
  }

  if (action === "generate-lesson-pack") {
    const titleInput = app.querySelector('[data-field="lesson-pack-title"]');
    const themeInput = app.querySelector('[data-field="lesson-theme"]');
    const countInput = app.querySelector('[data-field="lesson-pack-count"]');
    const importInput = app.querySelector('[data-field="lesson-import-json"]');
    const title = titleInput?.value?.trim() || adminLessonEditor?.title || "New Lesson Pack";
    const theme = themeInput?.value?.trim() || adminLessonEditor?.theme || "travel";
    const count = Number(countInput?.value ?? 3) || 3;
    const lessons = buildLessonPack(title, theme, count);
    if (importInput) {
      importInput.value = JSON.stringify(lessons, null, 2);
    }
    const result = await apiJson("/api/lessons/import", {
      method: "POST",
      body: { lessons },
    });
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Generated lesson pack: ${result.imported} lessons` },
    });
    await refreshState();
  }

  if (action === "import-lessons") {
    const importInput = app.querySelector('[data-field="lesson-import-json"]');
    const raw = importInput?.value?.trim();
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.alert("Lesson import JSON is not valid.");
      return;
    }
    const result = await apiJson("/api/lessons/import", {
      method: "POST",
      body: Array.isArray(parsed) ? { lessons: parsed } : parsed,
    });
    if (importInput) {
      importInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Imported lessons: ${result.imported}` },
    });
    await refreshState();
  }

  if (action === "queue-content-review") {
    const noteInput = app.querySelector('[data-field="content-review-note"]');
    const note = noteInput?.value?.trim() || "Manually queued from admin panel";
    const lesson = adminLessonEditor ?? state.lessons.find((entry) => entry.id === state.activeLessonId) ?? state.lessons[0];
    if (!lesson) {
      return;
    }
    await apiJson("/api/admin/content-review", {
      method: "POST",
      body: {
        itemType: "lesson",
        itemId: lesson.id,
        notes: note,
        source: adminLessonEditor?.id ? "lesson-edit" : "manual",
      },
    });
    if (noteInput) {
      noteInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Queued lesson review: ${lesson.id}` },
    });
    await refreshState();
  }

  if (action === "import-dictionary") {
    const dictionaryInput = app.querySelector('[data-field="dictionary-import-json"]');
    const raw = dictionaryInput?.value?.trim();
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.alert("Dictionary import JSON is not valid.");
      return;
    }
    const result = await apiJson("/api/dictionary/import", {
      method: "POST",
      body: Array.isArray(parsed) ? { entries: parsed } : parsed,
    });
    if (dictionaryInput) {
      dictionaryInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Imported dictionary entries: ${result.imported}` },
    });
    await refreshState();
  }

  if (action === "import-kanji") {
    const kanjiInput = app.querySelector('[data-field="kanji-import-json"]');
    const raw = kanjiInput?.value?.trim();
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.alert("Kanji import JSON is not valid.");
      return;
    }
    const result = await apiJson("/api/kanji/import", {
      method: "POST",
      body: Array.isArray(parsed) ? { entries: parsed } : parsed,
    });
    if (kanjiInput) {
      kanjiInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Imported kanji entries: ${result.imported}` },
    });
    await refreshState();
  }

  if (action === "import-reviews") {
    const reviewInput = app.querySelector('[data-field="review-import-json"]');
    const raw = reviewInput?.value?.trim();
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.alert("Review import JSON is not valid.");
      return;
    }
    const result = await apiJson("/api/reviews/import", {
      method: "POST",
      body: Array.isArray(parsed) ? { reviews: parsed } : parsed,
    });
    if (reviewInput) {
      reviewInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Imported review items: ${result.imported}` },
    });
    await refreshState();
  }

  if (action === "import-dataset") {
    const datasetInput = app.querySelector('[data-field="dataset-import-json"]');
    const datasetFileInput = app.querySelector('[data-field="dataset-import-file"]');
    const file = datasetFileInput?.files?.[0] ?? null;
    const raw = file ? await file.text() : datasetInput?.value?.trim();
    if (!raw) {
      return;
    }
    const result = await apiJson("/api/datasets/import", {
      method: "POST",
      body: { bundle: raw, filename: file?.name ?? "" },
    });
    if (datasetInput) {
      datasetInput.value = "";
    }
    if (datasetFileInput) {
      datasetFileInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: {
        entry: `Imported dataset bundle: ${result.dictionaryEntries} dictionary, ${result.kanjiEntries} kanji, ${result.lessons} lessons, ${result.reviewItems} reviews`,
      },
    });
    await refreshState();
  }

  if (action === "import-dataset-url") {
    const datasetUrlInput = app.querySelector('[data-field="dataset-import-url"]');
    const sourceUrl = datasetUrlInput?.value?.trim();
    if (!sourceUrl) {
      return;
    }
    const result = await apiJson("/api/datasets/import-url", {
      method: "POST",
      body: { url: sourceUrl },
    });
    if (datasetUrlInput) {
      datasetUrlInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: {
        entry: `Imported dataset from URL: ${result.dictionaryEntries} dictionary, ${result.kanjiEntries} kanji, ${result.lessons} lessons, ${result.reviewItems} reviews`,
      },
    });
    await refreshState();
  }

  if (action === "run-ai-playground") {
    const feature = app.querySelector('[data-field="ai-playground-feature"]')?.value?.trim() || "grammar";
    const prompt = app.querySelector('[data-field="ai-playground-prompt"]')?.value?.trim() || "Explain よろしくお願いします";
    const scenario = app.querySelector('[data-field="ai-playground-scenario"]')?.value?.trim() || "restaurant";
    const title = app.querySelector('[data-field="ai-playground-title"]')?.value?.trim() || "Anime Dialogue";
    const theme = app.querySelector('[data-field="ai-playground-theme"]')?.value?.trim() || "anime";
    const result = await apiJson("/api/ai/response", {
      method: "POST",
      body: {
        feature,
        prompt,
        context: { scenario, title, theme },
      },
    });
    adminAiPlayground = {
      feature: result.feature,
      prompt: result.prompt,
      provider: result.provider,
      model: result.model,
      context: result.context,
      response: result.response,
    };
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Ran AI playground: ${feature}` },
    });
    render();
  }

  if (action === "export-backup") {
    const backupInput = app.querySelector('[data-field="backup-json"]');
    const snapshot = await apiJson("/api/admin/export");
    if (backupInput) {
      backupInput.value = JSON.stringify(snapshot, null, 2);
      backupInput.focus();
      backupInput.setSelectionRange(0, backupInput.value.length);
    }
  }

  if (action === "export-moderation-history") {
    const history = await apiJson("/api/admin/content-review-actions?limit=100");
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "moderation-history.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (action === "import-moderation-history") {
    const moderationInput = app.querySelector('[data-field="moderation-import-json"]');
    const raw = moderationInput?.value?.trim();
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.alert("Moderation JSON is not valid.");
      return;
    }
    const result = await apiJson("/api/admin/content-review-actions/import", {
      method: "POST",
      body: { actions: Array.isArray(parsed) ? parsed : [parsed] },
    });
    if (moderationInput) {
      moderationInput.value = "";
    }
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: `Imported moderation history: ${result.imported} actions` },
    });
    await refreshState();
  }

  if (action === "import-backup") {
    const backupInput = app.querySelector('[data-field="backup-json"]');
    const raw = backupInput?.value?.trim();
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.alert("Backup JSON is not valid.");
      return;
    }
    await apiJson("/api/admin/import", {
      method: "POST",
      body: { state: parsed },
    });
    await refreshState();
  }

  if (action === "delete-lesson") {
    const lessonId = button.dataset.lessonId;
    if (lessonId) {
      await apiJson(`/api/lessons/${encodeURIComponent(lessonId)}`, { method: "DELETE" });
      if (adminLessonEditor?.id === lessonId) {
        adminLessonEditor = null;
      }
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Deleted lesson: ${lessonId}` },
      });
      await refreshState();
    }
  }

  if (action === "review-content") {
    const reviewId = button.dataset.reviewId;
    const status = button.dataset.status;
    if (reviewId && status) {
      await apiJson(`/api/admin/content-review/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        body: {
          status,
          notes: `${status} via admin panel`,
          decisionReason: `${status} via admin panel`,
        },
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Content review ${status}: ${reviewId}` },
      });
      await refreshState();
    }
  }

  if (action === "save-permissions") {
    const roles = (state.admin.permissions?.roles ?? []).map((role) => {
      const nameInput = app.querySelector(`[data-field="role-name-${CSS.escape(role.id)}"]`);
      const permissions = (state.admin.permissions?.permissions ?? [])
        .filter((permission) => app.querySelector(`[data-field="role-permission-${CSS.escape(role.id)}-${CSS.escape(permission.id)}"]`)?.checked)
        .map((permission) => permission.name);
      return {
        id: role.id,
        name: nameInput?.value?.trim() || role.name,
        permissions,
      };
    });
    const result = await apiJson("/api/admin/permissions", {
      method: "PATCH",
      body: { roles, permissions: state.admin.permissions?.permissions ?? [] },
    });
    permissionDraft = result;
    await apiJson("/api/audit-log", {
      method: "POST",
      body: { entry: "Updated admin permissions" },
    });
    await refreshState();
  }

  if (action === "reload-permissions") {
    permissionDraft = null;
    render();
  }

  if (action === "search-users") {
    const username = app.querySelector('[data-field="user-filter-username"]')?.value?.trim() ?? "";
    const email = app.querySelector('[data-field="user-filter-email"]')?.value?.trim() ?? "";
    const status = app.querySelector('[data-field="user-filter-status"]')?.value?.trim() ?? "";
    const level = app.querySelector('[data-field="user-filter-level"]')?.value?.trim() ?? "";
    adminUserFilters = { username, email, status, level };
    const params = new URLSearchParams();
    if (username) params.set("username", username);
    if (email) params.set("email", email);
    if (status) params.set("status", status);
    if (level) params.set("level", level);
    adminUserDirectory = await apiJson(`/api/admin/users?${params.toString()}`);
    render();
  }

  if (action === "clear-user-filters") {
    adminUserFilters = { username: "", email: "", status: "", level: "" };
    adminUserDirectory = null;
    render();
  }

  if (action === "edit-user") {
    const userId = button.dataset.userId;
    const user = (state.admin.users ?? []).find((entry) => entry.id === userId)
      ?? (adminUserDirectory ?? []).find((entry) => entry.id === userId);
    if (user) {
      adminUserEditor = structuredClone(user);
      render();
    }
  }

  if (action === "cancel-user-edit") {
    adminUserEditor = null;
    render();
  }

  if (action === "save-user") {
    const username = app.querySelector('[data-field="user-username"]')?.value?.trim();
    const email = app.querySelector('[data-field="user-email"]')?.value?.trim();
    const level = Number(app.querySelector('[data-field="user-level"]')?.value ?? 1);
    const status = app.querySelector('[data-field="user-status"]')?.value?.trim() || "active";
    const credits = Number(app.querySelector('[data-field="user-credits"]')?.value ?? 0);
    const streak = Number(app.querySelector('[data-field="user-streak"]')?.value ?? 0);
    const payload = {
      id: adminUserEditor?.id || undefined,
      username: username || adminUserEditor?.username || "new-user",
      email: email || adminUserEditor?.email || "new-user@example.com",
      level: Number.isFinite(level) ? level : 1,
      status,
      credits: Number.isFinite(credits) ? credits : 0,
      streak: Number.isFinite(streak) ? streak : 0,
    };
    if (adminUserEditor?.id) {
      await apiJson(`/api/admin/users/${encodeURIComponent(adminUserEditor.id)}`, {
        method: "PATCH",
        body: payload,
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Updated user: ${payload.username}` },
      });
    } else {
      await apiJson("/api/admin/users", {
        method: "POST",
        body: payload,
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Created user: ${payload.username}` },
      });
    }
    adminUserEditor = null;
    adminUserDirectory = null;
    await refreshState();
  }

  if (action === "toggle-user-status") {
    const userId = button.dataset.userId;
    const status = button.dataset.status;
    if (userId && status) {
      await apiJson(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: { status },
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `User ${userId} marked ${status}` },
      });
      await refreshState();
    }
  }

  if (action === "adjust-user-credits") {
    const userId = button.dataset.userId;
    const delta = Number(button.dataset.delta || 0);
    const user = state.admin.users?.find((entry) => entry.id === userId);
    if (user && userId && delta) {
      await apiJson(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: { credits: Math.max(0, user.credits + delta) },
      });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Adjusted credits for ${user.username} by ${delta}` },
      });
      await refreshState();
    }
  }

  if (action === "delete-user") {
    const userId = button.dataset.userId;
    if (userId) {
      await apiJson(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
      await apiJson("/api/audit-log", {
        method: "POST",
        body: { entry: `Deleted user ${userId}` },
      });
      await refreshState();
    }
  }

  if (action === "reset-database") {
    await apiJson("/api/admin/reset", { method: "POST" });
    await refreshState();
  }

  if (action === "admin-login") {
    const username = app.querySelector('[data-field="admin-username"]')?.value?.trim() || "admin";
    const password = app.querySelector('[data-field="admin-password"]')?.value ?? "";
    // Land the waiting save first; the sign-in reply would otherwise replace it.
    await settlePendingSave();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      state = mergeState(state, await response.json());
    } else {
      window.alert("Admin sign-in failed.");
    }
    await refreshState();
  }

  if (action === "admin-change-password") {
    const currentPassword = app.querySelector('[data-field="admin-current-password"]')?.value ?? "";
    const newPassword = app.querySelector('[data-field="admin-new-password"]')?.value ?? "";
    try {
      await apiJson("/api/admin/password", { method: "POST", body: { currentPassword, newPassword } });
      adminPasswordFeedback = "Password changed.";
    } catch (error) {
      adminPasswordFeedback = error.message;
    }
    await refreshState();
  }

  if (action === "admin-logout") {
    await settlePendingSave();
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    await refreshState();
  }
}

function activeLessonPreview() {
  const lesson = state.lessons.find((entry) => entry.id === state.activeLessonId) ?? state.lessons[0];
  return lesson.vocab.map((item) =>
    state.toggles.furigana
      ? `${item.word} (${item.kana}) - ${item.meaning}`
      : `${item.word} - ${item.meaning}`
  );
}

function buildKanjiQuizChoices(review, reviewQueue, entries) {
  const uniqueChoices = new Set();
  uniqueChoices.add(review.meaning || review.character);
  (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry.character !== review.character)
    .forEach((entry) => {
      if (entry?.meaning) uniqueChoices.add(entry.meaning);
    });
  (Array.isArray(reviewQueue) ? reviewQueue : [])
    .filter((entry) => entry.character !== review.character)
    .forEach((entry) => {
      if (entry?.meaning) uniqueChoices.add(entry.meaning);
    });

  const fallbackChoices = ["action", "station", "request", "practice", "meeting", "training"];
  fallbackChoices.forEach((choice) => uniqueChoices.add(choice));
  const choices = Array.from(uniqueChoices).slice(0, 6);
  const targetSize = Math.min(4, choices.length);
  const seed = Array.from(String(review.character || review.id || "")).reduce((total, char) => total + char.codePointAt(0), 0);
  const rotation = choices.length ? seed % choices.length : 0;
  const rotated = choices.slice(rotation).concat(choices.slice(0, rotation));
  return rotated.slice(0, targetSize);
}

function renderLeaderboard() {
  const rows = state.admin.leaderboard?.length
    ? state.admin.leaderboard.map((row) => [row.name, `${row.xp} XP`, row.track])
    : [
        ["You", `${state.progress.xp} XP`, "Local"],
        ["Mika", "1110 XP", "Speaking"],
        ["Ren", "980 XP", "Kanji"],
        ["Yui", "930 XP", "Listening"],
      ];

  return `
    <div class="leaderboard">
      ${rows
        .map(
          (row, index) => `
            <div class="leaderboard-row">
              <span>${index + 1}. ${row[0]}</span>
              <span>${row[1]}</span>
              <span class="muted">${row[2]}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildLesson(title, theme) {
  return buildLessonDraft(title, theme);
}

async function speakText(text) {
  const sentence = String(text ?? "").trim();
  if (!sentence) return;

  try {
    const response = await fetch("/api/tts/synthesize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sentence, language: "ja" }),
    });
    if (response.ok) {
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      return;
    }
  } catch {
    // Fall back to browser TTS below.
  }

  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "ja-JP";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voices = speechSynthesis.getVoices();
  const japaneseVoice = chooseJapaneseVoice(voices);
  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
    if (!utterance.lang && japaneseVoice.lang) {
      utterance.lang = japaneseVoice.lang;
    }
  }
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function createSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

async function refreshState() {
  // Land any waiting save first, otherwise the reload would wipe the change.
  await settlePendingSave();
  state = await loadState();
  systemStatus = await loadSystemStatus();
  render();
}

async function recordSpeechFallback(fallbackText, transcriptOutput) {
  const fallback = String(fallbackText ?? "").trim() || "ラーメンをください。";
  if (transcriptOutput) transcriptOutput.textContent = "Recording with the local voice path...";
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    if (transcriptOutput) transcriptOutput.textContent = `Speech input unavailable. Using the reference sentence: ${fallback}`;
    return { transcript: fallback, source: "typed" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const recorder = createAudioRecorder(stream);
    if (!recorder) {
      stream.getTracks().forEach((track) => track.stop());
      if (transcriptOutput) transcriptOutput.textContent = `Speech recording unavailable. Using the reference sentence: ${fallback}`;
      return { transcript: fallback, source: "fallback" };
    }
    const transcription = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => reject(new Error("Unable to record speech."));
      recorder.onstop = async () => {
        try {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (!blob.size) {
            resolve({ transcript: fallback, source: "empty" });
            return;
          }
          if (transcriptOutput) transcriptOutput.textContent = "Transcribing with the local speech model...";
          const response = await fetch("/api/speech/transcribe", {
            method: "POST",
            headers: { "content-type": blob.type || "audio/webm" },
            body: blob,
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "Local transcription unavailable.");
          }
          const payload = await response.json();
          const transcript = String(payload.transcript ?? "").trim() || fallback;
          if (transcriptOutput) transcriptOutput.textContent = `Transcript: ${transcript}`;
          resolve({ transcript, source: payload.source ?? "whisper" });
        } catch (error) {
          if (transcriptOutput) transcriptOutput.textContent = `Speech transcription unavailable. Using the reference sentence: ${fallback}`;
          resolve({ transcript: fallback, source: "fallback", error });
        }
      };
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 3200));
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    return await transcription;
  } catch {
    if (transcriptOutput) transcriptOutput.textContent = `Speech input unavailable. Using the reference sentence: ${fallback}`;
    return { transcript: fallback, source: "fallback" };
  }
}

function createAudioRecorder(stream) {
  if (!("MediaRecorder" in window)) return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "",
  ];
  for (const mimeType of candidates) {
    try {
      return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      // Try the next supported mime type.
    }
  }
  return null;
}

function mergeState(base, saved) {
  if (Array.isArray(base)) return saved ?? base;
  if (typeof base !== "object" || base === null) return saved ?? base;

  const result = { ...base };
  for (const [key, value] of Object.entries(base)) {
    result[key] = mergeState(value, saved?.[key]);
  }
  return { ...saved, ...result };
}
