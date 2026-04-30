const STORAGE_KEY = "pop-culture-japanese-state";

const defaultState = {
  view: "learn",
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
    { name: "Sakura Theme", cost: 120, owned: true },
    { name: "Ramen Master Icon", cost: 80, owned: false },
    { name: "Manga Panel Background", cost: 160, owned: false },
  ],
  admin: {
    roles: ["Super Admin", "Content Admin", "Support Admin", "Analytics Admin"],
    aiUsage: {
      dailyRequests: 18,
      monthlyRequests: 362,
      cachedResponses: 124,
      failedRequests: 1,
    },
    siteHealth: "Green",
  },
};

const state = loadState();

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

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    return mergeState(defaultState, JSON.parse(saved));
  } catch {
    return structuredClone(defaultState);
  }
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

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const moduleCards = state.lessons.map(
    (lesson) => `
      <article class="grid-card">
        <p class="tag">${lesson.theme}</p>
        <h3>${lesson.title}</h3>
        <p class="muted">${lesson.difficulty}</p>
        <div class="kana">${state.toggles.furigana ? lesson.japanese : lesson.translation}</div>
        ${state.toggles.romaji ? `<p class="muted">${lesson.romaji}</p>` : ""}
        ${state.toggles.translation ? `<p>${lesson.translation}</p>` : ""}
        <p>${lesson.grammar}</p>
        <div class="tag-row">
          ${lesson.vocab.map((item) => `<span class="tag">${item.word} · ${item.meaning}</span>`).join("")}
        </div>
        <div class="button-row">
          <button class="primary" data-action="start-lesson" data-id="${lesson.id}">Study lesson</button>
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
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Practice</p>
          <h2>Speaking, listening, reading, and writing</h2>
        </div>
        <p>Whisper and local LLM hooks are reserved for later integration.</p>
      </div>
      <div class="practice-grid">
        ${practiceCard("Speaking", "Record yourself, then compare your sentence against a natural Japanese correction.", ["Transcribe", "Correct", "Suggest natural phrasing"])}
        ${practiceCard("Listening", "Play a scene and answer a quick comprehension prompt.", ["Browser TTS", "Static quiz", "Replay line"])}
        ${practiceCard("Reading", "Tap a word to reveal meaning, kana, and kanji details.", ["Furigana toggle", "Translation toggle", "Dictionary lookup"])}
        ${practiceCard("Writing", "Build sentences and validate them against simple rules or local AI corrections.", ["Sentence builder", "Typing drill", "Grammar feedback"])}
      </div>
    </section>
  `;
}

function renderReview() {
  const items = state.reviews
    .map(
      (item) => `
        <div class="list-item">
          <strong>${item.prompt}</strong>
          <p class="muted">${item.meaning}</p>
          <p>Answer: ${item.answer}</p>
          <p>Due: ${item.due} · Ease: ${item.ease.toFixed(1)}</p>
          <button class="secondary" data-action="mark-review" data-prompt="${item.prompt}">Mark correct</button>
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
        <p>LocalStorage persistence now, SQLite-ready later.</p>
      </div>
      <div class="stats-grid">
        ${renderStat("Kanji learned", state.progress.kanji)}
        ${renderStat("Vocabulary", state.progress.vocab)}
        ${renderStat("Speaking minutes", state.progress.speakingMinutes)}
        ${renderStat("Listening minutes", state.progress.listeningMinutes)}
      </div>
      <div class="progress-grid">
        <div class="grid-card">
          <h3>Daily tasks</h3>
          ${state.dailyTasks.map((task) => `<div class="list-item">${task.complete ? "✓" : "○"} ${task.name} <span class="muted">${task.reward}</span></div>`).join("")}
        </div>
        <div class="grid-card">
          <h3>Achievements</h3>
          ${state.achievements
            .map((achievement) => `<div class="list-item">${achievement.unlocked ? "🏆" : "◻"} ${achievement.name}</div>`)
            .join("")}
        </div>
        <div class="grid-card">
          <h3>Cosmetic shop</h3>
          ${state.cosmetics.map((item) => `<div class="list-item">${item.owned ? "Owned" : `${item.cost} credits`} · ${item.name}</div>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderAdmin() {
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>Manage content, AI usage, and system health</h2>
        </div>
        <p>Role-based permissions and audit logs are modeled in the UI.</p>
      </div>
      <div class="admin-grid">
        <div class="grid-card">
          <h3>Roles</h3>
          <div class="tag-row">${state.admin.roles.map((role) => `<span class="tag">${role}</span>`).join("")}</div>
        </div>
        <div class="grid-card">
          <h3>AI usage</h3>
          <p>Daily requests: ${state.admin.aiUsage.dailyRequests}</p>
          <p>Monthly requests: ${state.admin.aiUsage.monthlyRequests}</p>
          <p>Cached responses: ${state.admin.aiUsage.cachedResponses}</p>
          <p>Failed requests: ${state.admin.aiUsage.failedRequests}</p>
        </div>
        <div class="grid-card">
          <h3>Site health</h3>
          <p class="${state.admin.siteHealth === "Green" ? "muted" : ""}">Status: ${state.admin.siteHealth}</p>
          <p>Maintenance mode, content review, and analytics hooks are reserved for the next slice.</p>
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

function practiceCard(title, description, steps) {
  return `
    <article class="grid-card">
      <p class="tag">${title}</p>
      <p>${description}</p>
      <div class="tag-row">${steps.map((step) => `<span class="tag">${step}</span>`).join("")}</div>
    </article>
  `;
}

function wireActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "start-lesson") {
        const lesson = state.lessons.find((entry) => entry.id === button.dataset.id);
        if (lesson) {
          window.alert(`${lesson.title}\n\n${lesson.japanese}\n${lesson.translation}`);
        }
      }

      if (action === "speak-lesson") {
        const lesson = state.lessons.find((entry) => entry.id === button.dataset.id);
        if (lesson && "speechSynthesis" in window) {
          speechSynthesis.cancel();
          speechSynthesis.speak(new SpeechSynthesisUtterance(lesson.japanese));
        }
      }

      if (action === "open-feature") {
        state.view = "practice";
        persist();
        render();
      }

      if (action === "open-roleplay") {
        window.alert("Roleplay mode is planned in the next slice: restaurant, travel, and anime-style conversations.");
      }

      if (action === "mark-review") {
        const item = state.reviews.find((entry) => entry.prompt === button.dataset.prompt);
        if (item) item.ease = Math.min(2.8, item.ease + 0.1);
        state.progress.xp += 20;
        state.progress.credits += 5;
        persist();
        render();
      }
    });
  });
}

