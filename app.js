import { buildLessonDraft, buildLessonPack, escapeHtml } from "./shared.mjs";

const defaultState = {
  view: "learn",
  activeLessonId: "anime-intro",
  toggles: {
    furigana: true,
    romaji: false,
    translation: true,
  },
  progress: {
    xp: 1280,
    level: 8,
    credits: 245,
    streak: 12,
    kanji: 54,
    vocab: 218,
    speakingMinutes: 34,
    listeningMinutes: 89,
    completedLessons: ["anime-intro"],
    reviewedWords: 118,
    speakingSessions: 7,
    listeningExercises: 22,
  },
  lessons: [
    {
      id: "anime-intro",
      title: "Anime Dialogue: First Encounter",
      theme: "anime dialogue",
      difficulty: "N5",
      japanese: "はじめまして。今日はよろしくお願いします。",
      romaji: "Hajimemashite. Kyou wa yoroshiku onegaishimasu.",
      translation: "Nice to meet you. Please be kind to me today.",
      grammar: "Polite introductory phrase with はじめまして and よろしくお願いします.",
      vocab: [
        { word: "はじめまして", kana: "はじめまして", meaning: "nice to meet you" },
        { word: "今日", kana: "きょう", meaning: "today" },
        { word: "よろしく", kana: "よろしく", meaning: "kindly / best regards" },
      ],
      kanji: ["今日", "願"],
    },
    {
      id: "food-ramen",
      title: "Food Culture: Ramen Order",
      theme: "food culture",
      difficulty: "N5",
      japanese: "ラーメンを一つください。スープはあっさりでお願いします。",
      romaji: "Raamen o hitotsu kudasai. Suupu wa assari de onegaishimasu.",
      translation: "One ramen, please. Light broth, please.",
      grammar: "Use を with a quantity and でお願いします for a polite request.",
      vocab: [
        { word: "一つ", kana: "ひとつ", meaning: "one item" },
        { word: "あっさり", kana: "あっさり", meaning: "light / not heavy" },
        { word: "お願いします", kana: "おねがいします", meaning: "please" },
      ],
      kanji: ["一", "汁"],
    },
    {
      id: "history-samurai",
      title: "Samurai History: Resolve",
      theme: "samurai/history",
      difficulty: "N4",
      japanese: "武士は言葉より行動で示す。",
      romaji: "Bushi wa kotoba yori koudou de shimesu.",
      translation: "A samurai shows through action rather than words.",
      grammar: "Comparison structure より and the dictionary form of 示す for stated principle.",
      vocab: [
        { word: "武士", kana: "ぶし", meaning: "samurai / warrior" },
        { word: "行動", kana: "こうどう", meaning: "action" },
        { word: "示す", kana: "しめす", meaning: "to show" },
      ],
      kanji: ["武", "行", "示"],
    },
  ],
  reviews: [
    { prompt: "一つ", answer: "ひとつ", meaning: "one item", due: "Now", ease: 2.5 },
    { prompt: "武士", answer: "ぶし", meaning: "samurai", due: "In 1 day", ease: 2.3 },
    { prompt: "よろしくお願いします", answer: "よろしくおねがいします", meaning: "please treat me well", due: "Now", ease: 2.1 },
  ],
  kanjiReviews: [
    {
      id: "kanji-review-今日",
      character: "今日",
      prompt: "What does 今日 mean?",
      answer: "today",
      meaning: "today",
      onYomi: "コン",
      kunYomi: "きょう",
      examples: ["今日はよろしくお願いします。"],
      due: "Now",
      ease: 2.5,
      interval_days: 1,
      repetitions: 0,
      mistakes: 0,
      source_entry_id: "kanji-kiyou",
      source: "seed",
    },
    {
      id: "kanji-review-一",
      character: "一",
      prompt: "What does 一 mean?",
      answer: "one",
      meaning: "one",
      onYomi: "イチ",
      kunYomi: "ひとつ",
      examples: ["ラーメンを一つください。"],
      due: "In 1 day",
      ease: 2.4,
      interval_days: 1,
      repetitions: 0,
      mistakes: 0,
      source_entry_id: "kanji-ichiji",
      source: "seed",
    },
    {
      id: "kanji-review-武",
      character: "武",
      prompt: "What does 武 mean?",
      answer: "warrior",
      meaning: "warrior",
      onYomi: "ブ",
      kunYomi: "たけ",
      examples: ["武士は言葉より行動で示す。"],
      due: "In 1 day",
      ease: 2.3,
      interval_days: 1,
      repetitions: 0,
      mistakes: 0,
      source_entry_id: "kanji-bushi",
      source: "seed",
    },
  ],
  achievements: [
    { name: "First Lesson Completed", unlocked: true },
    { name: "7-Day Streak", unlocked: true },
    { name: "50 Kanji Learned", unlocked: true },
    { name: "100 Words Reviewed", unlocked: false },
    { name: "First Spoken Conversation", unlocked: false },
    { name: "Anime Dialogue Master", unlocked: false },
  ],
  dailyTasks: [
    { name: "Complete 1 lesson", reward: "+40 XP", complete: true },
    { name: "Review 10 vocabulary items", reward: "+30 XP", complete: false },
    { name: "Practice 3 kanji", reward: "+20 XP", complete: false },
    { name: "Speak 5 sentences", reward: "+50 XP", complete: false },
  ],
  cosmetics: [
    { name: "Sakura Theme", cost: 120, owned: true, equipped: true },
    { name: "Ramen Master Icon", cost: 80, owned: false },
    { name: "Manga Panel Background", cost: 160, owned: false },
  ],
  admin: {
    roles: ["Super Admin", "Content Admin", "Support Admin", "Analytics Admin"],
    permissions: {
      roles: [
        { name: "Super Admin", permissions: ["Manage content", "Manage users", "View analytics", "Manage AI usage"] },
        { name: "Content Admin", permissions: ["Manage content", "Manage AI usage"] },
        { name: "Support Admin", permissions: ["Manage users"] },
        { name: "Analytics Admin", permissions: ["View analytics"] },
      ],
      permissions: [
        { name: "Manage content" },
        { name: "Manage users" },
        { name: "View analytics" },
        { name: "Manage AI usage" },
      ],
    },
    aiUsage: {
      dailyRequests: 18,
      monthlyRequests: 362,
      cachedResponses: 124,
      failedRequests: 1,
    },
    siteHealth: "Green",
    maintenanceMode: false,
    announcements: "Practice 5 minutes a day to keep the streak alive.",
    authenticated: false,
    sessionUser: null,
    auditLog: [
      "Published anime dialogue module",
      "Approved 12 grammar explanations",
      "Updated free AI usage limits",
    ],
    contentReviewQueue: [
      { id: "content-review-1", itemType: "lesson", itemId: "anime-intro", status: "pending", notes: "Seeded review queue" },
    ],
    users: [
      { id: "user-1", username: "mika", email: "mika@example.com", level: 11, status: "active", credits: 340, streak: 18 },
      { id: "user-2", username: "ren", email: "ren@example.com", level: 9, status: "active", credits: 220, streak: 12 },
      { id: "user-3", username: "yui", email: "yui@example.com", level: 7, status: "suspended", credits: 180, streak: 4 },
    ],
    challenges: [
      { id: "challenge-anime-dialogue", title: "7-Day Anime Dialogue Challenge", description: "Complete anime dialogue lessons to build streak momentum.", category: "lesson", targetCount: 3, rewardXp: 120, rewardCredits: 40, claimed: false, progress: 3 },
      { id: "challenge-kanji-sprint", title: "Kanji Sprint", description: "Hit focused study sessions for kanji practice.", category: "study", targetCount: 5, rewardXp: 150, rewardCredits: 50, claimed: false, progress: 2 },
      { id: "challenge-listening-week", title: "Listening Week", description: "Complete listening drills and keep the audio loop going.", category: "listening", targetCount: 4, rewardXp: 100, rewardCredits: 35, claimed: false, progress: 1 },
    ],
    leaderboard: [
      { name: "You", xp: 1280, track: "Local" },
      { name: "Mika", xp: 1110, track: "Speaking" },
      { name: "Ren", xp: 980, track: "Kanji" },
      { name: "Yui", xp: 930, track: "Listening" },
    ],
  },
  roleplay: {
    scenario: "restaurant",
    transcript: [
      { speaker: "System", text: "Welcome to the roleplay table. Pick a scene and answer naturally." },
      { speaker: "You", text: "ラーメンをください。" },
      { speaker: "Server", text: "かしこまりました。スープはあっさりにしますか？" },
    ],
  },
  tutor: {
    question: "Can you explain よろしくお願いします?",
    answer:
      "It is a compact phrase for polite collaboration. In context it means 'please take care of me' or 'I look forward to working with you.'",
  },
  chest: {
    ready: true,
    lastReward: "Rare badge: Sakura Night",
  },
};

let state = structuredClone(defaultState);
let dictionaryLookup = [];
let adminLessonEditor = null;
let adminUserEditor = null;
let adminUserDirectory = null;
let adminUserFilters = {
  username: "",
  email: "",
  status: "",
  level: "",
};
let adminAiPlayground = null;
let listeningScenarioIndex = 0;
let speakingPromptIndex = 0;
let readingSelection = null;
let kanjiSelection = null;
let kanjiReviewIndex = 0;
let kanjiReviewFeedback = "";

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

render();
init();

async function init() {
  try {
    state = await loadState();
    render();
  } catch {
    state = structuredClone(defaultState);
    render();
  }
}

async function loadState() {
  const response = await fetch("/api/state");
  if (!response.ok) throw new Error("Failed to load state");
  return mergeState(defaultState, await response.json());
}

async function apiJson(path, options = {}) {
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

function persist() {
  fetch("/api/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state),
  }).catch(() => {});
}

function render() {
  syncHeader();

  const views = {
    learn: renderLearn,
    practice: renderPractice,
    review: renderReview,
    progress: renderProgress,
    admin: renderAdmin,
  };

  app.innerHTML = views[state.view]();
  wireActions();
}

function syncHeader() {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  toggleButtons.forEach((button) => {
    const key = button.dataset.toggle;
    const label = key[0].toUpperCase() + key.slice(1);
    button.textContent = `${label}: ${state.toggles[key] ? "On" : "Off"}`;
  });
}

function renderLearn() {
  const activeLesson = state.lessons.find((lesson) => lesson.id === state.activeLessonId) ?? state.lessons[0];
  const selectedKanjiEntry = kanjiSelection ?? state.kanjiEntries?.find((entry) => activeLesson.kanji.includes(entry.character)) ?? state.kanjiEntries?.[0] ?? null;
  const moduleCards = state.lessons.map(
    (lesson) => `
      <article class="grid-card">
        <p class="tag">${escapeHtml(lesson.theme)}</p>
        <h3>${escapeHtml(lesson.title)}</h3>
        <p class="muted">${escapeHtml(lesson.difficulty)}</p>
        <div class="kana">${escapeHtml(state.toggles.furigana ? lesson.japanese : lesson.translation)}</div>
        ${state.toggles.romaji ? `<p class="muted">${escapeHtml(lesson.romaji)}</p>` : ""}
        ${state.toggles.translation ? `<p>${escapeHtml(lesson.translation)}</p>` : ""}
        <p>${escapeHtml(lesson.grammar)}</p>
        <div class="tag-row">
          ${lesson.vocab
            .map((item) => `<span class="tag">${escapeHtml(item.word)} · ${escapeHtml(item.meaning)}</span>`)
            .join("")}
        </div>
        <div class="button-row">
          <button class="primary" data-action="select-lesson" data-id="${lesson.id}">Study lesson</button>
          <button class="secondary" data-action="speak-lesson" data-id="${lesson.id}">Play audio</button>
        </div>
      </article>
    `
  );

  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Learn through anime, food, history, and daily life</p>
        <h2>Pop culture context first, then grammar, vocab, kanji, and review.</h2>
        <p class="muted">Everything is local-first. Lessons are pre-generated JSON, progress lives in your browser, and the AI hooks are structured to stay optional and cheap.</p>
        <div class="button-row">
          <button class="primary" data-action="open-feature">Start a 5-minute study run</button>
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
    <section class="panel lesson-layout">
      <div class="grid-card">
        <p class="eyebrow">Featured lesson</p>
        <h2>${escapeHtml(activeLesson.title)}</h2>
        <p class="muted">${escapeHtml(activeLesson.theme)} · ${escapeHtml(activeLesson.difficulty)}</p>
        <p class="kana">${escapeHtml(state.toggles.furigana ? activeLesson.japanese : activeLesson.translation)}</p>
        ${state.toggles.romaji ? `<p class="muted">${escapeHtml(activeLesson.romaji)}</p>` : ""}
        ${state.toggles.translation ? `<p>${escapeHtml(activeLesson.translation)}</p>` : ""}
        <p>${escapeHtml(activeLesson.grammar)}</p>
        <div class="button-row">
          <button class="primary" data-action="complete-lesson" data-id="${activeLesson.id}">Complete lesson</button>
          <button class="secondary" data-action="speak-lesson" data-id="${activeLesson.id}">Listen to line</button>
          <button class="secondary" data-action="explain-grammar" data-id="${activeLesson.id}">Explain grammar</button>
        </div>
        <p class="muted" data-output="grammar-feedback">${escapeHtml(state.tutor.answer)}</p>
        <div class="grid-card spaced">
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
        <div class="grid-card">
        <h3>Vocabulary</h3>
        <div class="list">
          ${activeLesson.vocab
            .map(
              (item) => `
                <div class="list-item">
                  <strong>${escapeHtml(item.word)}</strong>
                  <div class="muted">${escapeHtml(item.kana)}</div>
                  <div>${escapeHtml(item.meaning)}</div>
                </div>
              `
            )
            .join("")}
        </div>
        <h3 class="spaced">Kanji</h3>
        <div class="tag-row">
          ${activeLesson.kanji
            .map((item) => `<button class="tag" data-action="lookup-kanji" data-term="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
            .join("")}
        </div>
        <div class="grid-card nested spaced">
          <p class="eyebrow">Kanji library</p>
          <div class="list">
            ${(state.kanjiEntries ?? [])
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
                  <p class="muted">${escapeHtml((selectedKanjiEntry.examples ?? []).slice(0, 2).join(" · ") || "No examples available.")}</p>
                `
                : "<p class='muted'>Select a kanji to see readings and examples.</p>"
            }
          </div>
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
      <div class="module-grid">${moduleCards.join("")}</div>
    </section>
  `;
}

function renderPractice() {
  const listeningScenario = listeningScenarios[listeningScenarioIndex % listeningScenarios.length];
  const speakingPrompt = speakingPrompts[speakingPromptIndex % speakingPrompts.length];
  const selectedDictionaryEntry = readingSelection ?? dictionaryLookup[0] ?? null;
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Practice</p>
          <h2>Speaking, listening, reading, and writing</h2>
        </div>
        <p>Speaking, listening, reading, and writing now flow through the local API and seeded data model.</p>
      </div>
      <div class="practice-grid">
        ${practiceCard(
          "Speaking",
          "Record yourself, then compare your sentence against a natural Japanese correction.",
          ["Transcribe", "Correct", "Suggest natural phrasing"],
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
            <p class="muted" data-output="transcription-feedback">No transcript yet. Use browser speech recognition when available.</p>
            <p class="muted" data-output="speaking-feedback">${escapeHtml(state.tutor.answer)}</p>
          `
        )}
        ${practiceCard(
          "Listening",
          "Play a scene and answer a quick comprehension prompt.",
          ["Browser TTS", "Static quiz", "Replay line"],
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
            <p class="muted" data-output="listening-feedback">Choose the best answer after listening.</p>
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
                      .map((item) => `${item.term} (${item.reading || "—"}) · ${item.meaning}`)
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
                    ? `
                      <strong>${escapeHtml(kanjiSelection.character)}</strong>
                      <p class="muted">${escapeHtml(kanjiSelection.onYomi || "No on-yomi stored")} / ${escapeHtml(kanjiSelection.kunYomi || "No kun-yomi stored")}</p>
                      <p>${escapeHtml(kanjiSelection.meaning)}</p>
                      <p class="muted">${escapeHtml((kanjiSelection.examples ?? []).slice(0, 2).join(" · ") || "No examples available.")}</p>
                    `
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
            <p class="muted" data-output="writing-feedback">Use particles, polite forms, and short sentences.</p>
          `
        )}
        ${practiceCard(
          "AI Tutor",
          "Ask about grammar, meaning, or nuance. The local fallback keeps responses brief and cheap.",
          ["Short prompts", "No long history", "Local-first"],
          `
            <label class="field">
              <span>Question</span>
              <input type="text" data-field="tutor-input" value="${escapeHtml(state.tutor.question)}" />
            </label>
            <div class="button-row">
              <button class="primary" data-action="ask-tutor">Ask tutor</button>
            </div>
            <p class="muted" data-output="tutor-feedback">${escapeHtml(state.tutor.answer)}</p>
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
            <div class="button-row">
              <button class="primary" data-action="send-roleplay">Reply naturally</button>
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
  const items = state.reviews
    .map(
      (item) => `
        <div class="list-item">
          <strong>${item.prompt}</strong>
          <p class="muted">${item.meaning}</p>
          <p>Answer: ${item.answer}</p>
          <p>Due: ${item.due} · Ease: ${item.ease.toFixed(1)}</p>
          <div class="button-row">
            <button class="secondary" data-action="grade-review" data-review-id="${item.id}" data-grade="2">Again</button>
            <button class="secondary" data-action="grade-review" data-review-id="${item.id}" data-grade="3">Hard</button>
            <button class="primary" data-action="grade-review" data-review-id="${item.id}" data-grade="4">Good</button>
            <button class="secondary" data-action="grade-review" data-review-id="${item.id}" data-grade="5">Easy</button>
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
              <div class="review-result">${escapeHtml(kanjiReviewFeedback || "Pick the meaning that matches the kanji.")}</div>
              <div class="button-row">
                <button class="secondary" data-action="kanji-next-review">Next kanji</button>
                <button class="secondary" data-action="kanji-show-readings" data-character="${escapeHtml(kanjiReview.character)}">Show readings</button>
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
            <input type="password" data-field="admin-password" value="fieldguide123" />
          </label>
          <div class="button-row">
            <button class="primary" data-action="admin-login">Sign in</button>
          </div>
        </div>
      </section>
    `;
  }

  const lessonDraft = adminLessonEditor ?? {
    id: "",
    title: "",
    theme: "custom",
    difficulty: "N5",
    japanese: "",
    romaji: "",
    translation: "",
    grammar: "",
  };
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
      <div class="admin-grid">
        <div class="grid-card">
          <h3>Roles</h3>
          <div class="tag-row">${state.admin.roles.map((role) => `<span class="tag">${role}</span>`).join("")}</div>
          <h4 class="spaced">Permissions</h4>
          <div class="list">
            ${(state.admin.permissions?.roles ?? [])
              .map(
                (role) => `
                  <div class="list-item">
                    <strong>${escapeHtml(role.name)}</strong>
                    <span class="muted">${escapeHtml(role.permissions.join(", "))}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card">
          <h3>AI usage</h3>
          <p>Provider: ${escapeHtml(state.admin.aiUsage.provider ?? "fallback")}${state.admin.aiUsage.ready ? ` · ${escapeHtml(state.admin.aiUsage.model ?? "llama3")} at ${escapeHtml(state.admin.aiUsage.host ?? "http://127.0.0.1:11434")}` : ""}</p>
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
              <p class="muted">Provider: ${escapeHtml(adminAiPlayground.provider ?? "fallback")} ${adminAiPlayground.model ? `· ${escapeHtml(adminAiPlayground.model)}` : ""}</p>
              <pre class="code-block">${escapeHtml(adminAiPlayground.response ?? "")}</pre>
            </div>
          ` : ""}
        </div>
        <div class="grid-card">
          <h3>Analytics</h3>
          <p>${state.admin.analytics?.xpEvents ?? 0} XP events · ${state.admin.analytics?.xpAwarded ?? 0} XP awarded</p>
          <p>${state.admin.analytics?.creditEvents ?? 0} credit events · ${state.admin.analytics?.creditsAwarded ?? 0} credits awarded</p>
          <p>${state.admin.analytics?.studySessions ?? 0} study sessions · ${state.admin.analytics?.studyMinutes ?? 0} minutes</p>
          <p>${state.admin.analytics?.reviewHistory ?? 0} review events · ${state.admin.analytics?.kanjiReviewHistory ?? 0} kanji review events</p>
          <p>${state.kanjiEntries?.length ?? 0} kanji entries · ${state.kanjiReviews?.length ?? 0} kanji drills</p>
          <p>${state.admin.analytics?.topLessons?.length ?? 0} lesson-linked review groups · ${state.admin.analytics?.topKanji?.length ?? 0} trending kanji</p>
          <h4 class="spaced">Top study kinds</h4>
          <div class="list">
            ${(state.admin.analytics?.sessionKinds ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <strong>${escapeHtml(item.kind)}</strong>
                    <span class="muted">${item.count} sessions · ${item.durationMinutes} min</span>
                  </div>
                `
              )
              .join("")}
          </div>
          <h4 class="spaced">Top kanji</h4>
          <div class="list">
            ${(state.admin.analytics?.topKanji ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <strong>${escapeHtml(item.character)}</strong>
                    <span class="muted">${item.reviewCount} reviews</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="grid-card">
          <h3>Site health</h3>
          <p class="${state.admin.siteHealth === "Green" ? "muted" : ""}">Status: ${state.admin.siteHealth}</p>
          <p>Maintenance mode, content review, and analytics hooks are managed from the SQLite-backed admin layer.</p>
          <button class="secondary" data-action="toggle-maintenance">Toggle maintenance</button>
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
              placeholder='[{"character":"駅","meaning":"station","onYomi":"エキ","kunYomi":"","examples":["駅はどこですか。"]}]'
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
          <h4 class="spaced">Content review queue</h4>
          <div class="list">
            ${(state.admin.contentReviewQueue ?? [])
              .map(
                (item) => `
                  <div class="list-item">
                    <strong>${escapeHtml(item.itemType)}</strong>
                    <span class="muted">${escapeHtml(item.status)} · ${escapeHtml(item.source ?? "seed")} · ${escapeHtml(item.notes)}</span>
                    <div class="button-row">
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="approved">Approve</button>
                      <button class="secondary" data-action="review-content" data-review-id="${escapeHtml(item.id)}" data-status="rejected">Reject</button>
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

function renderStat(label, value) {
  return `
    <div class="stat">
      <strong>${value}</strong>
      <span class="muted">${label}</span>
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

function wireActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "select-lesson") {
        state.activeLessonId = button.dataset.id;
        persist();
        render();
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
        if (lesson && "speechSynthesis" in window) {
          speechSynthesis.cancel();
          speechSynthesis.speak(new SpeechSynthesisUtterance(lesson.japanese));
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

      if (action === "transcribe-speaking") {
        const transcriptOutput = app.querySelector('[data-output="transcription-feedback"]');
        const speakingInput = app.querySelector('[data-field="speaking-input"]');
        const recognition = createSpeechRecognition();
        if (!recognition) {
          const fallback = speakingInput?.value?.trim() || "ラーメンをください。";
          if (transcriptOutput) transcriptOutput.textContent = `Transcript fallback: ${fallback}`;
          if (speakingInput) speakingInput.value = fallback;
          return;
        }
        if (transcriptOutput) transcriptOutput.textContent = "Listening for speech...";
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript ?? "")
            .join(" ")
            .trim();
          if (transcriptOutput) transcriptOutput.textContent = `Transcript: ${transcript || "No speech detected."}`;
          if (speakingInput && transcript) speakingInput.value = transcript;
        };
        recognition.onerror = () => {
          if (transcriptOutput) transcriptOutput.textContent = "Speech recognition failed. Use the text box instead.";
        };
        recognition.onend = () => {
          if (transcriptOutput && transcriptOutput.textContent === "Listening for speech...") {
            transcriptOutput.textContent = "Speech recognition ended without a result.";
          }
        };
        recognition.start();
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
          await refreshState();
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
        kanjiSelection = state.kanjiEntries?.find((entry) => entry.character === character)
          ?? state.kanjiReviews?.find((entry) => entry.character === character)
          ?? null;
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
        if (output) output.textContent = next.tutor?.answer ?? state.tutor.answer;
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
        speakText("ラーメンをください。");
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
        if (output) {
          output.textContent = answer === answerKey ? `Correct. ${prompt}.` : `Not quite. ${prompt}.`;
        }
        await refreshState();
      }

      if (action === "replay-listening") {
        const scenario = listeningScenarios[listeningScenarioIndex % listeningScenarios.length];
        speakText(scenario.question);
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
        if (output) output.textContent = result.tutor?.answer ?? state.tutor.answer;
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
        if (output) output.textContent = next.tutor?.answer ?? state.tutor.answer;
        await refreshState();
      }

      if (action === "send-roleplay") {
        const select = app.querySelector('[data-field="roleplay-scenario"]');
        const scenario = select?.value ?? "restaurant";
        await apiJson("/api/practice", {
          method: "POST",
          body: { kind: "roleplay", scenario },
        });
        await refreshState();
      }

      if (action === "lookup-word") {
        const term = button.dataset.term ?? "";
        dictionaryLookup = await apiJson(`/api/dictionary?query=${encodeURIComponent(term)}`);
        readingSelection = dictionaryLookup[0] ?? null;
        render();
      }

      if (action === "lookup-kanji") {
        const term = button.dataset.term ?? "";
        kanjiSelection = state.kanjiEntries?.find((entry) => entry.character === term) ?? null;
        render();
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

      if (action === "save-lesson") {
        const titleInput = app.querySelector('[data-field="lesson-title"]');
        const themeInput = app.querySelector('[data-field="lesson-theme"]');
        const difficultyInput = app.querySelector('[data-field="lesson-difficulty"]');
        const japaneseInput = app.querySelector('[data-field="lesson-japanese"]');
        const romajiInput = app.querySelector('[data-field="lesson-romaji"]');
        const translationInput = app.querySelector('[data-field="lesson-translation"]');
        const grammarInput = app.querySelector('[data-field="lesson-grammar"]');
        const title = titleInput?.value?.trim();
        if (!title && !adminLessonEditor) {
          return;
        }
        const theme = themeInput?.value?.trim() || adminLessonEditor?.theme || "custom";
        const baseLesson = buildLesson(title || adminLessonEditor?.title || "New Lesson", theme);
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
            body: { status, notes: `${status} via admin panel` },
          });
          await apiJson("/api/audit-log", {
            method: "POST",
            body: { entry: `Content review ${status}: ${reviewId}` },
          });
          await refreshState();
        }
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
        const password = app.querySelector('[data-field="admin-password"]')?.value?.trim() || "fieldguide123";
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

      if (action === "admin-logout") {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
        await refreshState();
      }
    });
  });
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

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
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
  state = await loadState();
  render();
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
