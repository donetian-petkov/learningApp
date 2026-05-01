import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStorageAdapter } from "../db.mjs";
import { answerAiFeature, answerTutor, buildLessonDraft, buildLessonPack, buildRoleplayTranscript, calculateLevel, chooseJapaneseVoice, escapeHtml, evaluateListeningAnswer, evaluateSpeakingSubmission, evaluateWritingSubmission, normalizeSentence, sm2Next } from "../shared.mjs";

function createTempStore() {
  const dir = mkdtempSync(join(tmpdir(), "pop-culture-japanese-"));
  const file = join(dir, "learning.sqlite");
  const store = createStorageAdapter(file);
  return { store, dir };
}

function cleanupTempStore(temp) {
  temp.store.close();
  rmSync(temp.dir, { recursive: true, force: true });
}

test("SQLite store seeds lessons, progress, and admin defaults", () => {
  const temp = createTempStore();
  try {
    const snapshot = temp.store.getSnapshot();
    assert.equal(snapshot.lessons.length, 3);
    assert.equal(snapshot.reviews.length, 3);
    assert.equal(snapshot.progress.xp, 1280);
    assert.equal(snapshot.progress.level, calculateLevel(snapshot.progress.xp));
    assert.equal(snapshot.admin.authenticated, false);
    assert.equal(snapshot.admin.roles.length, 4);
    assert.equal(temp.store.getSchemaVersion(), 7);
    assert.equal(Array.isArray(snapshot.kanjiEntries), true);
    assert.equal(snapshot.kanjiEntries.length >= 3, true);
    assert.equal(Array.isArray(snapshot.kanjiReviews), true);
    assert.equal(snapshot.kanjiReviews.length >= 3, true);
    assert.equal(snapshot.admin.users.length, 3);
    assert.equal(snapshot.admin.challenges.length, 3);
  } finally {
    cleanupTempStore(temp);
  }
});

test("lesson CRUD works through the SQLite adapter", () => {
  const temp = createTempStore();
  try {
    const created = temp.store.createLesson({
      id: "travel-station",
      title: "Travel: Train Station",
      theme: "travel",
      difficulty: "N5",
      japanese: "駅はどこですか。",
      romaji: "Eki wa doko desu ka.",
      translation: "Where is the station?",
      grammar: "Question form for directions.",
      vocab: [{ word: "駅", kana: "えき", meaning: "station" }],
      kanji: ["駅"],
    });
    assert.equal(created.id, "travel-station");
    assert.equal(temp.store.getLessons().some((lesson) => lesson.id === "travel-station"), true);

    const updated = temp.store.updateLesson("travel-station", {
      title: "Travel: Station Directions",
      translation: "Where is the station entrance?",
    });
    assert.equal(updated.title, "Travel: Station Directions");
    assert.equal(updated.translation, "Where is the station entrance?");

    assert.equal(temp.store.deleteLesson("travel-station"), true);
    assert.equal(temp.store.getLessons().some((lesson) => lesson.id === "travel-station"), false);
  } finally {
    cleanupTempStore(temp);
  }
});

test("lesson imports batch upsert through the SQLite adapter", () => {
  const temp = createTempStore();
  try {
    const imported = temp.store.importLessons([
      {
        id: "imported-convenience-store",
        title: "Anime: Convenience Store",
        theme: "anime",
        difficulty: "N5",
        japanese: "いらっしゃいませ。",
        romaji: "Irasshaimase.",
        translation: "Welcome.",
        grammar: "Greeting used by shop staff.",
      },
      {
        id: "imported-travel-ticket",
        title: "Travel: Ticket Counter",
        theme: "travel",
        difficulty: "N5",
        japanese: "切符をください。",
        romaji: "Kippu o kudasai.",
        translation: "A ticket, please.",
        grammar: "Polite request with をください.",
      },
    ]);
    assert.equal(imported.length, 2);
    assert.equal(temp.store.getLessons().some((lesson) => lesson.id === "imported-convenience-store"), true);
    assert.equal(temp.store.getLessons().some((lesson) => lesson.id === "imported-travel-ticket"), true);

    const updated = temp.store.importLessons({
      id: "imported-convenience-store",
      title: "Anime: Store Greeting",
      theme: "anime",
      difficulty: "N5",
      japanese: "いらっしゃいませ。",
      romaji: "Irasshaimase.",
      translation: "Welcome.",
      grammar: "Greeting used by shop staff.",
    });
    assert.equal(updated.length, 1);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.title, "Anime: Store Greeting");
  } finally {
    cleanupTempStore(temp);
  }
});

test("review grading applies SM-2 updates and records history", () => {
  const temp = createTempStore();
  try {
    const before = temp.store.getReviews()[0];
    const graded = temp.store.gradeReview(before.id, 5);
    assert.ok(graded.interval_days >= 1);
    assert.ok(graded.ease >= before.ease);
    const historyCount = temp.store.db.prepare("SELECT COUNT(*) AS count FROM review_history WHERE review_item_id = ?").get(before.id).count;
    assert.equal(historyCount, 1);

    const again = temp.store.gradeReview(before.id, 2);
    assert.equal(again.repetitions, 0);
    const note = temp.store.db.prepare("SELECT note FROM review_history WHERE review_item_id = ? ORDER BY id DESC LIMIT 1").get(before.id).note;
    assert.equal(note, "again");
  } finally {
    cleanupTempStore(temp);
  }
});

test("gamification helpers persist reward claims and settings", () => {
  const temp = createTempStore();
  try {
    const chest = temp.store.claimRewardChest();
    assert.equal(typeof chest.reward, "string");
    assert.ok(chest.state.progress.credits >= 245);

    const settings = temp.store.updateSettings({ announcements: "Updated", maintenanceMode: true });
    assert.equal(settings.announcements, "Updated");
    assert.equal(settings.maintenanceMode, true);
    assert.equal(temp.store.getSettings().maintenanceMode, true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("progress, task, cosmetic, and practice mutations persist in SQLite", () => {
  const temp = createTempStore();
  try {
    const lessonResult = temp.store.completeLesson("food-ramen");
    assert.equal(lessonResult.progress.completedLessons.includes("food-ramen"), true);
    assert.ok(lessonResult.progress.xp > 1280);

    const task = temp.store.getSnapshot().dailyTasks.find((entry) => !entry.complete);
    assert.ok(task);
    const taskResult = temp.store.completeTask(task.id);
    assert.equal(taskResult.progress.streak > 12, true);

    const cosmetic = temp.store.getSnapshot().cosmetics.find((entry) => !entry.owned);
    assert.ok(cosmetic);
    const cosmeticResult = temp.store.buyCosmetic(cosmetic.id);
    assert.equal(cosmeticResult.progress.credits < 245, true);

    const equipped = temp.store.equipCosmetic("cosmetic-sakura-theme");
    assert.equal(equipped.cosmetics.find((entry) => entry.id === "cosmetic-sakura-theme").equipped, true);

    const speaking = temp.store.recordPracticeSession("speaking", { input: "ラーメンをください" });
    assert.equal(speaking.tutor.answer.startsWith("Natural correction:"), true);
    assert.equal(speaking.progress.speakingSessions >= 8, true);
    assert.equal(speaking.roleplay.transcript[1].speaker, "You");

    const listening = temp.store.recordPracticeSession("listening", {
      answer: "broth",
      answerKey: "broth",
      prompt: "the server asked about broth",
    });
    assert.equal(listening.tutor.answer.includes("Correct"), true);

    const writing = temp.store.recordPracticeSession("writing", { input: "私は毎日日本語を勉強します" });
    assert.equal(writing.tutor.answer.includes("Natural correction:"), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("admin credentials and audit logging work", () => {
  const temp = createTempStore();
  try {
    assert.equal(temp.store.verifyAdminCredentials("admin", "fieldguide123"), true);
    const session = temp.store.createSession("admin");
    assert.ok(session);
    assert.equal(Boolean(temp.store.getSession(session)), true);
    temp.store.appendAudit("Manual audit entry");
    assert.equal(temp.store.getAuditLog().some((entry) => entry.includes("Manual audit entry")), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("admin content review queue and permissions persist", () => {
  const temp = createTempStore();
  try {
    const queue = temp.store.getContentReviewQueue();
    assert.ok(queue.length >= 1);
    assert.equal(typeof queue[0].source, "string");
    const reviewed = temp.store.reviewContentItem(queue[0].id, { status: "approved", notes: "Looks good" });
    assert.equal(reviewed[0].status, "approved");
    assert.equal(reviewed[0].notes, "Looks good");
    assert.equal(reviewed[0].source, queue[0].source);

    const enqueued = temp.store.enqueueContentReview({
      itemType: "lesson",
      itemId: "anime-intro",
      notes: "Manual quality check",
      source: "manual",
    });
    assert.equal(enqueued.some((item) => item.itemId === "anime-intro" && item.source === "manual"), true);

    const permissions = temp.store.getPermissionMatrix();
    assert.equal(permissions.roles.some((role) => role.name === "Super Admin"), true);
    assert.equal(permissions.permissions.some((permission) => permission.name === "Manage content"), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("analytics summary is derived from persisted activity", async () => {
  const temp = createTempStore();
  try {
    temp.store.completeLesson("food-ramen");
    temp.store.recordStudySession("lesson", 10, 40, 5);
    temp.store.recordStudySession("review", 6, 20, 0);
    await temp.store.aiResponse("tutor", "Explain は", { lessonTitle: "Anime" });
    const analytics = temp.store.getSnapshot().admin.analytics;
    assert.ok(analytics.xpEvents >= 1);
    assert.ok(analytics.studySessions >= 2);
    assert.ok(analytics.aiRequests >= 1);
    assert.ok(Array.isArray(analytics.sessionKinds));
    assert.ok(Array.isArray(analytics.dailyAi));
  } finally {
    cleanupTempStore(temp);
  }
});

test("snapshot export and restore preserve persisted state", () => {
  const temp = createTempStore();
  try {
    temp.store.completeLesson("food-ramen");
    const snapshot = temp.store.getSnapshot();
    temp.store.resetDatabase();
    const restored = temp.store.saveAppState(snapshot);
    assert.equal(restored.progress.completedLessons.includes("food-ramen"), true);
    assert.equal(restored.lessons.some((lesson) => lesson.id === "anime-intro"), true);
    assert.equal(restored.admin.maintenanceMode, false);
  } finally {
    cleanupTempStore(temp);
  }
});

test("dictionary entries can be imported in batch", () => {
  const temp = createTempStore();
  try {
    const imported = temp.store.importDictionaryEntries([
      {
        term: "ありがとう",
        reading: "ありがとう",
        meaning: "thank you",
        partOfSpeech: "expression",
        example: "ありがとう。",
      },
      {
        term: "頑張る",
        reading: "がんばる",
        meaning: "to do one's best",
        partOfSpeech: "verb",
        example: "頑張ります。",
      },
    ]);
    assert.equal(imported.length, 2);
    assert.equal(temp.store.lookupDictionary("ありがとう")?.meaning, "thank you");
    assert.equal(temp.store.lookupDictionary("頑張る")?.partOfSpeech, "verb");
  } finally {
    cleanupTempStore(temp);
  }
});

test("kanji entries can be imported and looked up", () => {
  const temp = createTempStore();
  try {
    const imported = temp.store.importKanjiEntries([
      {
        character: "駅",
        meaning: "station",
        onYomi: "エキ",
        kunYomi: "",
        examples: ["駅はどこですか。"],
      },
      {
        character: "願",
        meaning: "wish / request",
        onYomi: "ガン",
        kunYomi: "ねが.う",
        examples: ["よろしくお願いします。"],
      },
    ]);
    assert.equal(imported.length, 2);
    assert.equal(temp.store.lookupKanji("駅")?.meaning, "station");
    assert.equal(temp.store.lookupKanji("願")?.onYomi, "ガン");
    assert.equal(temp.store.getKanjiEntries("駅").length >= 1, true);
    const review = temp.store.getKanjiReviews().find((entry) => entry.character === "駅");
    assert.ok(review);
    const graded = temp.store.gradeKanjiReview(review.id, 5);
    assert.equal(graded.character, "駅");
    assert.equal(temp.store.getKanjiReviews().find((entry) => entry.id === review.id)?.repetitions >= 1, true);
    assert.equal(temp.store.getSnapshot().admin.analytics.kanjiReviewHistory >= 1, true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("review items can be imported in batch", () => {
  const temp = createTempStore();
  try {
    const imported = temp.store.importReviewItems([
      {
        id: "review-import-1",
        prompt: "一つ",
        answer: "ひとつ",
        meaning: "one item",
        due: "Now",
        ease: 2.5,
        interval_days: 1,
        repetitions: 0,
        mistakes: 0,
        source_lesson_id: "anime-intro",
      },
      {
        id: "review-import-2",
        prompt: "武士",
        answer: "ぶし",
        meaning: "samurai",
        due: "In 1 day",
        ease: 2.3,
        interval_days: 2,
        repetitions: 1,
        mistakes: 0,
        source_lesson_id: "history-samurai",
      },
    ]);
    assert.equal(imported.length, 2);
    const reviews = temp.store.getReviews();
    assert.equal(reviews.some((review) => review.id === "review-import-1"), true);
    assert.equal(reviews.some((review) => review.id === "review-import-2"), true);
    assert.equal(temp.store.getSnapshot().admin.auditLog.some((entry) => entry.includes("Imported review items: 2")), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("user management mutations and reset work", () => {
  const temp = createTempStore();
  try {
    const filtered = temp.store.getUsers({ username: "mika", status: "active", level: 11 });
    assert.equal(filtered.length, 1);
    const user = temp.store.getUsers({ username: "mika" })[0];
    assert.ok(user);
    const updated = temp.store.updateUser(user.id, { status: "suspended", credits: user.credits + 25 });
    assert.equal(updated.status, "suspended");
    assert.equal(updated.credits, user.credits + 25);
    const inserted = temp.store.upsertUser({
      id: "user-x",
      username: "akira",
      email: "akira@example.com",
      level: 5,
      status: "active",
      credits: 50,
      streak: 2,
    });
    assert.equal(inserted.username, "akira");
    assert.equal(temp.store.getUsers({ username: "akira" }).length, 1);
    assert.equal(temp.store.deleteUser("user-x"), true);
    assert.equal(temp.store.getUsers({ username: "akira" }).length, 0);

    const resetSnapshot = temp.store.resetDatabase();
    assert.equal(resetSnapshot.lessons.length, 3);
    assert.equal(temp.store.getSchemaVersion(), 7);
  } finally {
    cleanupTempStore(temp);
  }
});

test("dictionary lookup and ai responses are available locally", async () => {
  const temp = createTempStore();
  try {
    const dictionary = temp.store.getDictionary("よろしく");
    assert.ok(dictionary.length >= 1);
    assert.equal(dictionary[0].term.includes("よろしく"), true);

    const particle = temp.store.getDictionary("は")[0];
    assert.ok(particle);
    assert.equal(particle.partOfSpeech, "particle");
    assert.equal(temp.store.lookupDictionary("ください")?.meaning.includes("please"), true);

    const ai = await temp.store.aiResponse("grammar", "Explain より", { lessonTitle: "Samurai History" });
    assert.equal(ai.feature, "grammar");
    assert.equal(ai.response.includes("Samurai History"), true);
    assert.ok(["ollama", "fallback"].includes(ai.provider));

    const sessions = temp.store.recordStudySession("lesson", 5, 80, 20);
    assert.equal(Array.isArray(sessions), true);
    assert.equal(temp.store.getStudySessions(1).length, 1);
    assert.equal(answerAiFeature("challenge-name", "Kanji Sprint").includes("Kanji Sprint"), true);
    assert.equal(answerAiFeature("badge-description", "Ramen Star").includes("Ramen Star"), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("listening answers produce contextual feedback", () => {
  assert.equal(evaluateListeningAnswer("broth", "broth", "the server asked about broth").includes("Correct"), true);
  assert.equal(evaluateListeningAnswer("broth", "price", "the server asked about broth").includes("Not quite"), true);
});

test("speaking submission evaluation returns transcript and guidance", () => {
  const evaluation = evaluateSpeakingSubmission("私は毎日日本語を勉強します", "私は毎日日本語を勉強します。");
  assert.equal(typeof evaluation.score, "number");
  assert.ok(evaluation.correction.startsWith("Natural correction:"));
  assert.ok(Array.isArray(evaluation.issues));
  assert.equal(evaluation.transcript.includes("。"), true);
});

test("writing submission evaluation returns score and guidance", () => {
  const evaluation = evaluateWritingSubmission("私は毎日日本語を勉強します");
  assert.equal(typeof evaluation.score, "number");
  assert.ok(evaluation.correction.startsWith("Natural correction:"));
  assert.ok(Array.isArray(evaluation.issues));
  assert.ok(evaluation.issues.some((issue) => issue.includes("period")));
});

test("lesson draft generation returns theme-based content", () => {
  const draft = buildLessonDraft("Train Station", "travel");
  assert.equal(draft.title, "Train Station");
  assert.equal(draft.theme, "travel");
  assert.ok(draft.japanese.includes("切符売り場") || draft.japanese.includes("どこ"));
  assert.ok(Array.isArray(draft.vocab));
});

test("lesson pack generation returns multiple imported lessons", () => {
  const pack = buildLessonPack("Travel Pack", "travel", 4);
  assert.equal(pack.length, 4);
  assert.equal(new Set(pack.map((lesson) => lesson.id)).size, 4);
  assert.ok(pack.every((lesson) => lesson.title.startsWith("Travel Pack")));
  assert.ok(pack.some((lesson) => lesson.japanese.includes("切符売り場")));
});

test("lesson draft generation covers broader themes", () => {
  const daily = buildLessonDraft("Morning Routine", "daily life");
  const manga = buildLessonDraft("Panel Hook", "manga");
  const etiquette = buildLessonDraft("Polite Request", "etiquette");
  assert.equal(daily.theme, "daily life");
  assert.ok(daily.japanese.includes("駅") || daily.japanese.includes("朝ごはん"));
  assert.ok(manga.japanese.includes("コマ"));
  assert.ok(etiquette.translation.includes("Sorry for the trouble") || etiquette.translation.includes("please"));
});

test("leaderboard is populated and updates from study progress", () => {
  const temp = createTempStore();
  try {
    const initial = temp.store.getSnapshot().admin.leaderboard;
    assert.ok(initial.length >= 4);
    assert.equal(initial[0].name, "You");

    temp.store.completeLesson("history-samurai");
    const updated = temp.store.getSnapshot().admin.leaderboard;
    assert.ok(updated.length >= 4);
    assert.ok(updated[0].xp > initial[0].xp);
  } finally {
    cleanupTempStore(temp);
  }
});

test("challenges persist and can be claimed", () => {
  const temp = createTempStore();
  try {
    temp.store.bumpChallenges("lesson", 5);
    const before = temp.store.getChallenges();
    assert.equal(before.length, 3);
    const after = temp.store.claimChallenge("challenge-anime-dialogue");
    const claimed = after.find((challenge) => challenge.id === "challenge-anime-dialogue");
    assert.equal(claimed.claimed, true);
    assert.equal(temp.store.getGamification().challenges.length, 3);
  } finally {
    cleanupTempStore(temp);
  }
});

test("shared helpers are deterministic and safe", () => {
  assert.equal(escapeHtml("<b>&</b>"), "&lt;b&gt;&amp;&lt;/b&gt;");
  assert.equal(normalizeSentence("ラーメンをください"), "ラーメンをください");
  assert.equal(normalizeSentence("今日は勉強します"), "今日は勉強します。");
  assert.equal(answerTutor("Explain particle usage"), "Use は for topic framing and が for focus or emphasis. In short: は sets the scene, が spotlights the subject.");
  assert.equal(buildRoleplayTranscript("travel").length, 4);
  const voice = chooseJapaneseVoice([
    { name: "English Voice", lang: "en-US" },
    { name: "Kyoko", lang: "ja-JP" },
  ]);
  assert.equal(voice?.lang, "ja-JP");
  assert.equal(answerAiFeature("grammar", "Explain より", { lessonTitle: "Samurai History" }).includes("Samurai History"), true);
  const sm2Hard = sm2Next({ interval_days: 1, repetitions: 0, ease: 2.5, mistakes: 0 }, 2);
  const sm2Easy = sm2Next({ interval_days: 1, repetitions: 0, ease: 2.5, mistakes: 0 }, 5);
  assert.equal(sm2Hard.repetitions, 0);
  assert.equal(sm2Easy.repetitions, 1);
  assert.equal(sm2Easy.ease > sm2Hard.ease, true);
});
