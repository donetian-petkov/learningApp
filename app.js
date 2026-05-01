import { escapeHtml } from "./shared.mjs";

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
    maintenanceMode: false,
    announcements: "Practice 5 minutes a day to keep the streak alive.",
    authenticated: false,
    sessionUser: null,
    auditLog: [
      "Published anime dialogue module",
      "Approved 12 grammar explanations",
      "Updated free AI usage limits",
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
        <div class="tag-row">${activeLesson.kanji.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
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
        <p>Speaking, listening, reading, and writing now flow through the local API and seeded data model.</p>
      </div>
      <div class="practice-grid">
        ${practiceCard(
          "Speaking",
          "Record yourself, then compare your sentence against a natural Japanese correction.",
          ["Transcribe", "Correct", "Suggest natural phrasing"],
          `
            <label class="field">
              <span>Try saying</span>
              <input type="text" data-field="speaking-input" value="ラーメンをください。" />
            </label>
            <div class="button-row">
              <button class="primary" data-action="check-speaking">Check speech</button>
              <button class="secondary" data-action="play-sample">Play sample</button>
            </div>
            <p class="muted" data-output="speaking-feedback">${escapeHtml(state.tutor.answer)}</p>
          `
        )}
        ${practiceCard(
          "Listening",
          "Play a scene and answer a quick comprehension prompt.",
          ["Browser TTS", "Static quiz", "Replay line"],
          `
            <p>What did the server ask?</p>
            <div class="tag-row">
              <button class="chip" data-action="listening-answer" data-answer="soup">Ask about broth</button>
              <button class="chip" data-action="listening-answer" data-answer="price">Ask about price</button>
              <button class="chip" data-action="listening-answer" data-answer="name">Ask your name</button>
            </div>
            <p class="muted" data-output="listening-feedback">Choose the best answer after listening.</p>
          `
        )}
        ${practiceCard(
          "Reading",
          "Tap a word to reveal meaning, kana, and kanji details.",
          ["Furigana toggle", "Translation toggle", "Dictionary lookup"],
          `
            <div class="list">
              ${activeLessonPreview().map((item) => `<div class="list-item">${item}</div>`).join("")}
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
  const items = state.reviews
    .map(
      (item) => `
        <div class="list-item">
          <strong>${item.prompt}</strong>
          <p class="muted">${item.meaning}</p>
          <p>Answer: ${item.answer}</p>
          <p>Due: ${item.due} · Ease: ${item.ease.toFixed(1)}</p>
          <button class="secondary" data-action="mark-review" data-review-id="${item.id}">Mark correct</button>
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
                  ${item.owned ? "Owned" : `${item.cost} credits`} · ${item.name}
                  ${item.owned ? "" : `<button class="secondary" data-action="buy-cosmetic" data-item="${item.name}">Buy</button>`}
                </div>
              `
            )
            .join("")}
        </div>
        <div class="grid-card">
          <h3>Level progress</h3>
          <div class="meter"><span style="width: ${Math.min(100, (state.progress.xp % 1000) / 10)}%"></span></div>
          <p class="muted">${state.progress.xp % 1000}/1000 XP to the next level</p>
          <p>Completed lessons: ${state.progress.completedLessons.length}</p>
          <p>Reviewed words: ${state.progress.reviewedWords}</p>
          <p>Speaking sessions: ${state.progress.speakingSessions}</p>
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
        </div>
        <div class="grid-card">
          <h3>Content management</h3>
          <div class="list">
            ${state.lessons
              .map(
                (lesson) => `<div class="list-item">${escapeHtml(lesson.title)} <span class="muted">${escapeHtml(lesson.theme)}</span></div>`
              )
              .join("")}
          </div>
          <label class="field">
            <span>New lesson title</span>
            <input type="text" data-field="lesson-title" placeholder="Travel: Train Station" />
          </label>
          <label class="field">
            <span>Theme</span>
            <input type="text" data-field="lesson-theme" placeholder="travel" />
          </label>
          <button class="primary" data-action="add-lesson">Add lesson</button>
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

      if (action === "mark-review") {
        const reviewId = button.dataset.reviewId;
        if (reviewId) {
          await apiJson(`/api/reviews/${encodeURIComponent(reviewId)}`, {
            method: "PATCH",
            body: { grade: 4 },
          });
          await apiJson("/api/gamification/award", {
            method: "POST",
            body: { source: "review-pass", delta: { xp: 20, credits: 5, streak: 0 } },
          });
          await refreshState();
        }
      }

      if (action === "check-speaking") {
        const input = app.querySelector('[data-field="speaking-input"]');
        const output = app.querySelector('[data-output="speaking-feedback"]');
        const next = await apiJson("/api/practice", {
          method: "POST",
          body: { kind: "speaking", input: input?.value ?? "" },
        });
        if (output) output.textContent = next.tutor?.answer ?? state.tutor.answer;
        await refreshState();
      }

      if (action === "play-sample") {
        speakText("ラーメンをください。");
      }

      if (action === "listening-answer") {
        const output = app.querySelector('[data-output="listening-feedback"]');
        const correct = button.dataset.answer === "soup";
        await apiJson("/api/practice", {
          method: "POST",
          body: { kind: "listening", answer: button.dataset.answer ?? "" },
        });
        if (output) {
          output.textContent = correct ? "Correct. The server asked about the broth." : "Not quite. Listen for a question about the broth.";
        }
        await refreshState();
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

      if (action === "add-lesson") {
        const titleInput = app.querySelector('[data-field="lesson-title"]');
        const themeInput = app.querySelector('[data-field="lesson-theme"]');
        const title = titleInput?.value?.trim();
        if (title) {
          await apiJson("/api/lessons", {
            method: "POST",
            body: buildLesson(title, themeInput?.value?.trim() || "custom"),
          });
          await apiJson("/api/gamification/award", {
            method: "POST",
            body: { source: "lesson-create", delta: { xp: 25, credits: 0, streak: 0 } },
          });
          await apiJson("/api/audit-log", {
            method: "POST",
            body: { entry: `Added lesson: ${title}` },
          });
          await refreshState();
        }
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

function renderLeaderboard() {
  const rows = [
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
  return {
    id: `lesson-${Date.now()}`,
    title,
    theme,
    difficulty: "N5",
    japanese: "きょうは新しい表現を学びます。",
    romaji: "Kyou wa atarashii hyougen o manabimasu.",
    translation: "Today we are learning a new expression.",
    grammar: "Custom lesson created from the admin panel.",
    vocab: [
      { word: "新しい", kana: "あたらしい", meaning: "new" },
      { word: "表現", kana: "ひょうげん", meaning: "expression" },
    ],
    kanji: ["新", "表", "現"],
  };
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
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
