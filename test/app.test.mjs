import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStorageAdapter } from "../db.mjs";
import { answerAiFeature, answerTutor, buildKanjiBreakdowns, buildLessonDraft, buildLessonPack, buildLessonProgressChecklist, buildRoleplayFollowUp, buildRoleplayTranscript, buildSceneBlueprint, calculateLevel, chooseJapaneseVoice, describeLessonExerciseType, escapeHtml, evaluateLessonExercise, evaluateListeningAnswer, evaluateSpeakingSubmission, evaluateWritingSubmission, filterLessonCatalog, filterModerationActions, findNextLessonId, normalizeSentence, sm2Next } from "../shared.mjs";

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

function createMockRequest(method, pathname, body = null, headers = {}) {
  const payload = body == null ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))];
  return {
    method,
    headers,
    url: pathname,
    async *[Symbol.asyncIterator]() {
      yield* payload;
    },
  };
}

function createMockResponse() {
  return {
    statusCode: 0,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = Buffer.isBuffer(body) ? body.toString("utf8") : String(body ?? "");
    },
  };
}

test("SQLite store seeds lessons, progress, and admin defaults", () => {
  const temp = createTempStore();
  try {
    const snapshot = temp.store.getSnapshot();
    assert.equal(snapshot.lessons.length, 10);
    assert.equal(snapshot.reviews.length >= 12, true);
    assert.equal(snapshot.progress.xp, 0);
    assert.equal(snapshot.progress.level, calculateLevel(snapshot.progress.xp));
    assert.equal(snapshot.progress.streakFreezeCount, 0);
    assert.equal(snapshot.admin.authenticated, false);
    assert.equal(snapshot.admin.roles.length, 4);
    assert.equal(temp.store.getSchemaVersion(), 19);
    assert.equal(temp.store.getMigrationHistory(1).length >= 1, true);
    assert.equal(Array.isArray(snapshot.kanjiEntries), true);
    assert.equal(snapshot.kanjiEntries.length >= 6, true);
    assert.equal(snapshot.kanjiEntries.every((entry) => Array.isArray(entry.radicals)), true);
    assert.equal(snapshot.kanjiEntries.some((entry) => entry.strokeCount > 0), true);
    assert.equal(snapshot.kanjiEntries.every((entry) => typeof entry.groupName === "string"), true);
    assert.equal(snapshot.kanjiEntries.some((entry) => Array.isArray(entry.relatedKanji) && entry.relatedKanji.length > 0), true);
    assert.equal(Array.isArray(snapshot.kanjiReviews), true);
    assert.equal(snapshot.kanjiReviews.length >= 6, true);
    assert.equal(Array.isArray(snapshot.lessons[0].scenes), true);
    assert.equal(snapshot.lessons[0].scenes.length >= 3, true);
    assert.equal(Array.isArray(snapshot.lessons[0].scenes[0].mediaRefs), true);
    assert.equal(Array.isArray(snapshot.lessons[0].media), true);
    assert.equal(Array.isArray(snapshot.lessons[0].popCultureNotes), true);
    assert.equal(Array.isArray(snapshot.lessons[0].kanjiBreakdowns), true);
    assert.equal(Array.isArray(snapshot.lessons[0].lessonGoals), true);
    assert.equal(Array.isArray(snapshot.lessons[0].referenceTags), true);
    assert.equal(Array.isArray(snapshot.lessons[0].exercises), true);
    assert.equal(snapshot.lessons[0].exercises.length >= 4, true);
    assert.equal(snapshot.lessons[0].exercises.some((exercise) => exercise.type === "cloze"), true);
    assert.equal(snapshot.admin.users.length, 0);
    assert.equal(snapshot.admin.challenges.length, 3);
  } finally {
    cleanupTempStore(temp);
  }
});

test("api handler can be imported without starting the server", async () => {
  const previous = process.env.LEARNINGAPP_DISABLE_SERVER;
  process.env.LEARNINGAPP_DISABLE_SERVER = "1";
  try {
    const { createApiHandler } = await import("../server.mjs");
    const handler = createApiHandler({
      getSession() {
        return null;
      },
      getSnapshot() {
        return {
          ok: true,
          lessons: [],
          reviews: [],
          kanjiEntries: [],
          kanjiReviews: [],
          admin: {
            users: [],
            aiUsage: {},
            datasetImports: [],
            maintenanceMode: false,
          },
        };
      },
      getLessons() {
        return [];
      },
      getDictionary() {
        return [];
      },
      getKanjiEntries() {
        return [];
      },
      getKanjiReviews() {
        return [];
      },
      getReviews() {
        return [];
      },
      getProgress() {
        return {};
      },
      getGamification() {
        return {};
      },
      getChallenges() {
        return [];
      },
      getStudySessions() {
        return [];
      },
      loadAdminState() {
        return {};
      },
      getAiUsage() {
        return {};
      },
      getAuditLog() {
        return [];
      },
      getSettings() {
        return {};
      },
      getContentReviewQueue() {
        return [];
      },
      getDatasetImports() {
        return [];
      },
      getPermissionMatrix() {
        return { roles: [], permissions: [] };
      },
      getSchemaVersion() {
        return 18;
      },
      getMigrationHistory() {
        return [{ version: 17, applied_at: new Date().toISOString() }];
      },
      buyStreakFreeze() {
        return { progress: { streakFreezeCount: 1 } };
      },
      getUsers() {
        return [];
      },
      toggleStudyBookmark() {
        return { savedWords: [], savedKanji: [] };
      },
      saveLessonNote() {
        return { lessonNotes: {} };
      },
    });
    const res = createMockResponse();
    await handler(createMockRequest("GET", "/api/health"), res, new URL("http://127.0.0.1/api/health"));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).ok, true);
    const bookmarkRes = createMockResponse();
    await handler(
      createMockRequest("POST", "/api/progress/bookmarks", { kind: "word", item: { term: "駅", reading: "えき" } }),
      bookmarkRes,
      new URL("http://127.0.0.1/api/progress/bookmarks")
    );
    assert.equal(bookmarkRes.statusCode, 200);
    const noteRes = createMockResponse();
    await handler(
      createMockRequest("POST", "/api/progress/lesson-note", { lessonId: "anime-intro", note: "Remember polite requests" }),
      noteRes,
      new URL("http://127.0.0.1/api/progress/lesson-note")
    );
    assert.equal(noteRes.statusCode, 200);
    const freezeRes = createMockResponse();
    await handler(
      createMockRequest("POST", "/api/gamification/streak-freeze"),
      freezeRes,
      new URL("http://127.0.0.1/api/gamification/streak-freeze")
    );
    assert.equal(freezeRes.statusCode, 200);
    const statusRes = createMockResponse();
    await handler(
      createMockRequest("GET", "/api/system/status"),
      statusRes,
      new URL("http://127.0.0.1/api/system/status")
    );
    assert.equal(statusRes.statusCode, 200);
    const status = JSON.parse(statusRes.body);
    assert.equal(status.database.schemaVersion, 18);
    assert.equal(status.database.imports, 0);
    assert.equal(Array.isArray(status.database.migrations), true);
  } finally {
    if (previous == null) delete process.env.LEARNINGAPP_DISABLE_SERVER;
    else process.env.LEARNINGAPP_DISABLE_SERVER = previous;
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
        media: [{ type: "reference", title: "Station card", caption: "Text reference", alt: "Station reference", source: "travel", uri: "", license: "local", sceneIndex: 0, orderIndex: 0 }],
        lessonGoals: ["Reach the station", "Ask for directions"],
        referenceTags: ["travel", "station"],
        grammarPoints: [
          { title: "Topic particle", explanation: "Use は to mark the topic.", example: "駅はどこですか。" },
          { title: "Direction", explanation: "Use ですか for a polite question.", example: "駅はどこですか。" },
        ],
      dialogueLines: [
        { speaker: "Narration", text: "At the station" },
        { speaker: "Speaker A", text: "駅はどこですか。" },
        { speaker: "Speaker B", text: "あちらです。" },
      ],
      exercises: [
        { type: "multiple-choice", prompt: "Pick the meaning of 駅", choices: ["station", "ticket", "platform"], answer: "station", explanation: "駅 means station." },
        { type: "translation", prompt: "Translate the line", choices: [], answer: "Where is the station?", explanation: "Direction question." },
      ],
    });
    assert.equal(created.id, "travel-station");
    assert.equal(temp.store.getLessons().some((lesson) => lesson.id === "travel-station"), true);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.grammarPoints.length, 2);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.exercises.length >= 4, true);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.exercises.some((exercise) => exercise.type === "cloze"), true);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.dialogueLines.length, 3);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.media.length, 1);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.lessonGoals.length, 2);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.referenceTags.length, 2);

    const updated = temp.store.updateLesson("travel-station", {
      title: "Travel: Station Directions",
      translation: "Where is the station entrance?",
      lessonGoals: ["Find the station entrance"],
      referenceTags: ["travel", "directions"],
    });
    assert.equal(updated.title, "Travel: Station Directions");
    assert.equal(updated.translation, "Where is the station entrance?");
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.lessonGoals.length, 1);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.referenceTags.length, 2);

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
      grammarPoints: [{ title: "Greeting", explanation: "Use いらっしゃいませ as a welcome line.", example: "いらっしゃいませ。" }],
      dialogueLines: [{ speaker: "Clerk", text: "いらっしゃいませ。" }, { speaker: "Customer", text: "おすすめをください。" }],
      exercises: [{ type: "multiple-choice", prompt: "What does いらっしゃいませ mean?", choices: ["welcome", "thank you"], answer: "welcome", explanation: "It is a store greeting." }],
    });
    assert.equal(updated.length, 1);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.title, "Anime: Store Greeting");
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.grammarPoints[0]?.title, "Greeting");
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.dialogueLines.length, 2);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.exercises.length >= 4, true);
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
    const before = temp.store.getSnapshot().progress;
    const chest = temp.store.claimRewardChest();
    assert.equal(typeof chest.reward, "string");
    assert.ok(
      chest.state.progress.xp > before.xp || chest.state.progress.credits > before.credits
    );

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
    const initial = temp.store.getSnapshot();
    const lessonResult = temp.store.completeLesson("food-ramen");
    assert.equal(lessonResult.progress.completedLessons.includes("food-ramen"), true);
    assert.ok(lessonResult.progress.xp > initial.progress.xp);
    assert.equal(lessonResult.progress.streakFreezeCount, 0);

    const task = temp.store.getSnapshot().dailyTasks.find((entry) => !entry.complete);
    assert.ok(task);
    const taskResult = temp.store.completeTask(task.id);
    assert.equal(taskResult.dailyTasks.find((entry) => entry.id === task.id).complete, true);
    assert.ok(taskResult.progress.xp > lessonResult.progress.xp);
    assert.equal(taskResult.progress.streakFreezeCount, 0);

    const seededCredits = temp.store.awardProgress({ xp: 0, credits: 100, streak: 0 }, "test-seed");
    const cosmetic = temp.store.getSnapshot().cosmetics.find((entry) => !entry.owned);
    assert.ok(cosmetic);
    const cosmeticResult = temp.store.buyCosmetic(cosmetic.id);
    assert.ok(cosmeticResult.progress.credits < seededCredits.progress.credits);

    const equipped = temp.store.equipCosmetic("cosmetic-sakura-theme");
    assert.equal(equipped.cosmetics.find((entry) => entry.id === "cosmetic-sakura-theme").equipped, true);

    const speaking = temp.store.recordPracticeSession("speaking", { input: "ラーメンをください" });
    assert.equal(speaking.tutor.answer.startsWith("Natural correction:"), true);
    assert.ok(speaking.progress.speakingSessions > initial.progress.speakingSessions);
    assert.equal(speaking.roleplay.transcript[1].speaker, "You");

    const listening = temp.store.recordPracticeSession("listening", {
      answer: "broth",
      answerKey: "broth",
      prompt: "the server asked about broth",
    });
    assert.equal(listening.tutor.answer.includes("Correct"), true);

    const writing = temp.store.recordPracticeSession("writing", { input: "私は毎日日本語を勉強します" });
    assert.equal(writing.tutor.answer.includes("Natural correction:"), true);

    const roleplay = temp.store.recordPracticeSession("roleplay", {
      scenario: "travel",
      input: "切符売り場はどこですか。",
    });
    assert.equal(roleplay.roleplay.transcript[1].speaker, "You");
    assert.equal(roleplay.roleplay.transcript[1].text, "切符売り場はどこですか。");
    assert.equal(roleplay.roleplay.transcript.some((line) => line.speaker === "Tutor"), true);

    const bookmarkedWord = temp.store.toggleStudyBookmark("word", {
      term: "駅",
      reading: "えき",
      meaning: "station",
      example: "駅はどこですか。",
      source: "lesson",
    });
    assert.equal(bookmarkedWord.savedWords.some((item) => item.term === "駅"), true);

    const bookmarkedKanji = temp.store.toggleStudyBookmark("kanji", {
      character: "駅",
      meaning: "station",
      onYomi: "エキ",
      kunYomi: "",
      examples: ["駅はどこですか。"],
      source: "lesson",
    });
    assert.equal(bookmarkedKanji.savedKanji.some((item) => item.character === "駅"), true);

    const clearedWord = temp.store.toggleStudyBookmark("word", {
      term: "駅",
      reading: "えき",
      meaning: "station",
      example: "駅はどこですか。",
      source: "lesson",
    });
    assert.equal(clearedWord.savedWords.some((item) => item.term === "駅"), false);

    const freezeSeed = temp.store.awardProgress({ xp: 0, credits: 60, streak: 0 }, "test-seed");
    const noteProgress = temp.store.saveLessonNote("anime-intro", "Remember よろしくお願いします for polite introductions.");
    assert.equal(noteProgress.lessonNotes["anime-intro"].includes("polite introductions"), true);
    assert.equal(temp.store.getSnapshot().progress.lessonNotes["anime-intro"].includes("よろしく"), true);
    const clearedNotes = temp.store.saveLessonNote("anime-intro", "");
    assert.equal(clearedNotes.lessonNotes["anime-intro"], undefined);

    const freeze = temp.store.buyStreakFreeze();
    assert.equal(freeze.progress.streakFreezeCount, 1);
    assert.equal(freeze.progress.credits, freezeSeed.progress.credits - 50);
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
    const reviewed = temp.store.reviewContentItem(queue[0].id, { status: "published", notes: "Looks good", decisionReason: "Ready to ship" }, "admin");
    assert.equal(reviewed[0].status, "published");
    assert.equal(reviewed[0].notes, "Looks good");
    assert.equal(reviewed[0].source, queue[0].source);
    assert.equal(reviewed[0].decisionReason, "Ready to ship");
    assert.equal(reviewed[0].reviewedBy, "admin");
    assert.equal(typeof reviewed[0].reviewedAt, "string");
    assert.equal(temp.store.getContentReviewActions(5).some((item) => item.queueItemId === queue[0].id && item.status === "published"), true);

    const enqueued = temp.store.enqueueContentReview({
      itemType: "lesson",
      itemId: "anime-intro",
      notes: "Manual quality check",
      source: "manual",
    });
    assert.equal(enqueued.some((item) => item.itemId === "anime-intro" && item.source === "manual"), true);
    assert.equal(temp.store.getContentReviewActions(5).some((item) => item.itemId === "anime-intro" && item.notes.includes("Manual quality check")), true);

    const permissions = temp.store.getPermissionMatrix();
    assert.equal(permissions.roles.some((role) => role.name === "Super Admin"), true);
    assert.equal(permissions.permissions.some((permission) => permission.name === "Manage content"), true);
    const updatedPermissions = temp.store.savePermissionMatrix({
      roles: permissions.roles.map((role) =>
        role.name === "Content Admin"
          ? { ...role, name: "Content Curator", permissions: ["Manage content"] }
          : role
      ),
      permissions: permissions.permissions,
    });
    assert.equal(updatedPermissions.roles.some((role) => role.name === "Content Curator"), true);
    assert.equal(
      updatedPermissions.roles.find((role) => role.name === "Content Curator")?.permissions.includes("Manage content"),
      true
    );
  } finally {
    cleanupTempStore(temp);
  }
});

test("moderation history imports and records dataset registry entries", () => {
  const temp = createTempStore();
  try {
    const imported = temp.store.importContentReviewActions([
      {
        id: 9001,
        queueItemId: "content-review-1",
        itemType: "lesson",
        itemId: "anime-intro",
        status: "published",
        decisionReason: "Ready to ship",
        reviewedBy: "admin",
        reviewedAt: "2025-01-01T10:00:00.000Z",
        notes: "Imported history entry",
        createdAt: "2025-01-01T10:00:00.000Z",
      },
    ]);
    assert.equal(imported.length, 1);
    const actions = temp.store.getContentReviewActions(5);
    assert.equal(actions.some((item) => item.id === 9001 && item.reviewedBy === "admin"), true);
    const imports = temp.store.getDatasetImports(1);
    assert.equal(imports[0].sourceType, "moderation-history");
    assert.equal(imports[0].counts.moderationActions, 1);
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
    temp.store.recordDatasetImport({
      sourceType: "bundle",
      label: "Analytics bundle",
      counts: { lessons: 1 },
      notes: "Analytics test",
    });
    temp.store.reviewContentItem(temp.store.getContentReviewQueue()[0].id, { status: "published", notes: "Analytics review", decisionReason: "ok" }, "admin");
    await temp.store.aiResponse("tutor", "Explain は", { lessonTitle: "Anime" });
    const analytics = temp.store.getSnapshot().admin.analytics;
    assert.ok(analytics.xpEvents >= 1);
    assert.ok(analytics.studySessions >= 2);
    assert.ok(analytics.aiRequests >= 1);
    assert.ok(Array.isArray(analytics.sessionKinds));
    assert.ok(Array.isArray(analytics.dailyAi));
    assert.ok(Array.isArray(analytics.moderationStatus));
    assert.ok(Array.isArray(analytics.moderationTypes));
    assert.ok(Array.isArray(analytics.importSources));
  } finally {
    cleanupTempStore(temp);
  }
});

test("snapshot export and restore preserve persisted state", () => {
  const temp = createTempStore();
  try {
    temp.store.updateLesson("anime-intro", {
      media: [
        {
          label: "Anime opening",
          kind: "clip",
          url: "https://example.com/opening.mp3",
          note: "Theme song cue",
        },
      ],
      lessonGoals: ["Use the intro phrase", "Identify the opening context"],
      referenceTags: ["anime", "intro"],
    });
    temp.store.completeLesson("food-ramen");
    temp.store.recordDatasetImport({
      sourceType: "bundle",
      label: "Seed bundle import",
      sourceUri: "https://example.com/bundle.json",
      counts: { lessons: 1 },
      notes: "Before export",
    });
    temp.store.enqueueContentReview({
      itemType: "lesson",
      itemId: "anime-intro",
      status: "pending",
      notes: "Before export",
      source: "manual",
    });
    const snapshot = temp.store.getSnapshot();
    temp.store.resetDatabase();
    const restored = temp.store.saveAppState(snapshot);
    assert.equal(restored.progress.completedLessons.includes("food-ramen"), true);
    assert.equal(restored.lessons.some((lesson) => lesson.id === "anime-intro"), true);
    assert.equal(restored.lessons.find((lesson) => lesson.id === "anime-intro")?.media.length, 1);
    assert.equal(restored.lessons.find((lesson) => lesson.id === "anime-intro")?.lessonGoals.length, 2);
    assert.equal(restored.lessons.find((lesson) => lesson.id === "anime-intro")?.referenceTags.length, 2);
    assert.equal(restored.admin.maintenanceMode, false);
    assert.equal(restored.admin.datasetImports.length >= 1, true);
    assert.equal(restored.admin.moderationActions.length >= 1, true);
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

test("dataset bundles import JMdict and KANJIDIC shaped entries", () => {
  const temp = createTempStore();
  try {
    const result = temp.store.importDatasetBundle({
      jmdictEntries: [
        {
          ent_seq: "1000000",
          k_ele: [{ keb: "感謝" }],
          r_ele: [{ reb: "かんしゃ" }],
          sense: [{ gloss: [{ text: "gratitude" }], pos: ["noun"] }],
        },
      ],
      kanjidicEntries: [
        {
          literal: "駅",
          readingMeaning: {
            groups: [
              {
                readings: [{ type: "ja_on", value: "エキ" }, { type: "ja_kun", value: "えき" }],
                meanings: [{ text: "station" }],
              },
            ],
          },
        },
      ],
    }, { filename: "bundle-sample.json" });
    assert.equal(result.dictionaryEntries, 1);
    assert.equal(result.kanjiEntries, 1);
    assert.equal(temp.store.lookupDictionary("感謝")?.meaning, "gratitude");
    assert.equal(temp.store.lookupKanji("駅")?.meaning, "station");
    assert.equal(temp.store.getSnapshot().admin.auditLog.some((entry) => entry.includes("Imported dataset bundle")), true);
    const imports = temp.store.getDatasetImports(1);
    assert.equal(imports.length, 1);
    assert.equal(imports[0].sourceType, "bundle");
    assert.equal(imports[0].counts.dictionaryEntries, 1);
    assert.equal(imports[0].label.includes("bundle-sample.json"), true);
    assert.equal(imports[0].notes.includes("Source file: bundle-sample.json"), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("dataset imports from url preserve source metadata", async () => {
  const temp = createTempStore();
  const previousFetch = global.fetch;
  const previousDisableServer = process.env.LEARNINGAPP_DISABLE_SERVER;
  try {
    process.env.LEARNINGAPP_DISABLE_SERVER = "1";
    const { importDatasetFromUrl } = await import("../server.mjs");
    global.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/xml" }),
      text: async () => `
        <JMdict>
          <entry>
            <ent_seq>2001</ent_seq>
            <k_ele><keb>感謝</keb></k_ele>
            <r_ele><reb>かんしゃ</reb></r_ele>
            <sense><pos>noun</pos><gloss>gratitude</gloss></sense>
          </entry>
        </JMdict>
      `,
    });
    const result = await importDatasetFromUrl(temp.store, "https://example.com/JMdict.xml", { label: "Remote JMdict" });
    assert.equal(result.dictionaryEntries, 1);
    const imports = temp.store.getDatasetImports(1);
    assert.equal(imports[0].sourceUri, "https://example.com/JMdict.xml");
    assert.equal(imports[0].label.includes("Remote JMdict"), true);
    assert.equal(imports[0].notes.includes("Source URL: https://example.com/JMdict.xml"), true);
  } finally {
    global.fetch = previousFetch;
    process.env.LEARNINGAPP_DISABLE_SERVER = previousDisableServer;
    cleanupTempStore(temp);
  }
});

test("dataset bundles import raw JMdict and KANJIDIC xml", () => {
  const temp = createTempStore();
  try {
    const result = temp.store.importDatasetBundle(`
      <JMdict>
        <entry>
          <ent_seq>1001</ent_seq>
          <k_ele><keb>ありがとうございます</keb></k_ele>
          <r_ele><reb>ありがとうございます</reb></r_ele>
          <sense>
            <pos>expression</pos>
            <gloss>thank you very much</gloss>
          </sense>
        </entry>
      </JMdict>
      <kanjidic2>
        <character>
          <literal>駅</literal>
          <reading_meaning>
            <rmgroup>
              <reading r_type="ja_on">エキ</reading>
              <reading r_type="ja_kun">うまや</reading>
              <meaning>station</meaning>
            </rmgroup>
          </reading_meaning>
        </character>
      </kanjidic2>
    `);
    assert.equal(result.dictionaryEntries >= 1, true);
    assert.equal(result.kanjiEntries >= 1, true);
    assert.equal(temp.store.getDictionary("ありがとうございます").length >= 1, true);
    assert.equal(temp.store.getKanjiEntries("駅").length >= 1, true);
    assert.equal(temp.store.getDatasetImports(1)[0].sourceType, "bundle");
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
        radicals: ["馬", "尺"],
        strokeCount: 14,
        strokeOrderSource: "lesson-derived",
        groupName: "transit",
        difficulty: "N5",
        relatedKanji: ["電", "通"],
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
    assert.equal(temp.store.lookupKanji("駅")?.groupName, "transit");
    assert.equal(temp.store.lookupKanji("駅")?.strokeCount, 14);
    assert.equal(temp.store.lookupKanji("駅")?.relatedKanji.includes("通"), true);
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
    temp.store.upsertUser({
      id: "user-mika",
      username: "mika",
      email: "mika@example.com",
      level: 11,
      status: "active",
      credits: 120,
      streak: 4,
    });
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
    assert.equal(resetSnapshot.lessons.length, 10);
    assert.equal(temp.store.getSchemaVersion(), 19);
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
    assert.ok(["ollama", "openai-compatible", "fallback"].includes(ai.provider));
    const cachedAi = await temp.store.aiResponse("grammar", "Explain より", { lessonTitle: "Samurai History" });
    assert.equal(cachedAi.cached, true);
    assert.equal(cachedAi.response, ai.response);

    const previousProvider = process.env.AI_PROVIDER;
    const previousBaseUrl = process.env.AI_BASE_URL;
    const previousModel = process.env.AI_MODEL;
    const previousFetch = global.fetch;
    try {
      process.env.AI_PROVIDER = "openai-compatible";
      process.env.AI_BASE_URL = "https://local-ai.example/v1";
      process.env.AI_MODEL = "local-model";
      global.fetch = async (url, options = {}) => {
        if (String(url).includes("/chat/completions")) {
          const payload = JSON.parse(String(options.body ?? "{}"));
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              choices: [{ message: { content: `OpenAI-compatible response: ${payload.messages?.[1]?.content ?? ""}` } }],
            }),
          };
        }
        throw new Error(`Unexpected fetch request: ${url}`);
      };
      const aiOpen = await temp.store.aiResponse("grammar", "Explain よろしくお願いします", { lessonTitle: "Anime Dialogue" });
      assert.equal(aiOpen.provider, "openai-compatible");
      assert.equal(aiOpen.model, "local-model");
      assert.equal(aiOpen.response.includes("OpenAI-compatible response"), true);
    } finally {
      process.env.AI_PROVIDER = previousProvider;
      process.env.AI_BASE_URL = previousBaseUrl;
      process.env.AI_MODEL = previousModel;
      global.fetch = previousFetch;
    }

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

test("roleplay follow-up generates a learner turn and reply", () => {
  const transcript = buildRoleplayFollowUp("travel", "切符売り場はどこですか。");
  assert.equal(transcript[0].speaker, "System");
  assert.equal(transcript[1].speaker, "You");
  assert.equal(transcript[2].speaker, "Server");
  assert.equal(transcript[3].speaker, "Tutor");
  assert.ok(transcript[2].text.includes("左"));
});

test("lesson exercise evaluation handles multiple choice and translation", () => {
  const choice = evaluateLessonExercise(
    {
      type: "multiple-choice",
      prompt: "Which meaning best fits?",
      choices: ["welcome", "thank you"],
      answer: "welcome",
      explanation: "It is a greeting.",
    },
    { selected: "welcome" }
  );
  assert.equal(choice.correct, true);
  assert.equal(choice.score, 100);
  assert.ok(choice.feedback.includes("Correct"));

  const translation = evaluateLessonExercise(
    {
      type: "translation",
      prompt: "Translate the line",
      answer: "Where is the ticket counter?",
      explanation: "Use a polite question.",
    },
    { input: "Where is the ticket counter" }
  );
  assert.equal(translation.correct, true);
  assert.ok(translation.feedback.includes("Correct"));

  const cloze = evaluateLessonExercise(
    {
      type: "cloze",
      prompt: "Fill the blank",
      answer: "light broth",
      explanation: "Use the scene context.",
    },
    { input: "light broth" }
  );
  assert.equal(cloze.correct, true);
  assert.ok(cloze.feedback.includes("Correct"));
});

test("lesson exercise evaluation normalizes ordering, dictation, and listening prompts", () => {
  const ordering = evaluateLessonExercise(
    {
      type: "ordering",
      prompt: "Put the line in order",
      answer: "A / B / C",
      explanation: "Keep the scene sequence intact.",
    },
    { order: ["A", "B", "C"] }
  );
  assert.equal(ordering.correct, true);
  assert.ok(ordering.feedback.includes("Correct"));

  const dictation = evaluateLessonExercise(
    {
      type: "dictation",
      prompt: "Type what you hear",
      answer: "今日はよろしくお願いします。",
      explanation: "Listen for the polite greeting.",
    },
    { input: "今日はよろしくお願いします" }
  );
  assert.equal(dictation.correct, true);

  const kana = evaluateLessonExercise(
    {
      type: "kana-reconstruction",
      prompt: "Rebuild the reading",
      answer: "あさごはん",
      explanation: "Recall the reading from the lesson.",
    },
    { input: "あさごはん" }
  );
  assert.equal(kana.correct, true);

  const listening = evaluateLessonExercise(
    {
      type: "listening-comprehension",
      prompt: "What context does this line belong to?",
      choices: ["shopping", "festival"],
      answer: "shopping",
      explanation: "The line is set in a shop scene.",
    },
    { selected: "shopping" }
  );
  assert.equal(listening.correct, true);
});

test("lesson exercise type descriptions stay explicit for the UI", () => {
  assert.equal(describeLessonExerciseType("ordering"), "Arrange the line in sequence.");
  assert.equal(describeLessonExerciseType("dictation"), "Type exactly what you hear.");
  assert.equal(describeLessonExerciseType("kana-reconstruction"), "Rebuild the reading from memory.");
  assert.equal(describeLessonExerciseType("listening-comprehension"), "Choose the answer that matches the audio context.");
});

test("lesson draft generation returns theme-based content", () => {
  const draft = buildLessonDraft("Train Station", "travel");
  assert.equal(draft.title, "Train Station");
  assert.equal(draft.theme, "travel");
  assert.ok(draft.japanese.includes("切符売り場") || draft.japanese.includes("どこ"));
  assert.ok(Array.isArray(draft.vocab));
  assert.ok(Array.isArray(draft.grammarPoints));
  assert.ok(Array.isArray(draft.dialogueLines));
  assert.ok(Array.isArray(draft.exercises));
  assert.ok(Array.isArray(draft.scenes) && draft.scenes.length >= 3);
  assert.ok(Array.isArray(draft.media) && draft.media.length >= 2);
  assert.ok(Array.isArray(draft.popCultureNotes) && draft.popCultureNotes.length >= 2);
  assert.ok(Array.isArray(draft.kanjiBreakdowns));
});

test("lesson draft generation covers the new curriculum themes", () => {
  const shopping = buildLessonDraft("Shopping Run", "shopping");
  const festival = buildLessonDraft("Festival Night", "festivals");
  const friendship = buildLessonDraft("Friendship Chat", "friendship");
  const transit = buildLessonDraft("Transit Announcements", "transit");

  assert.equal(shopping.theme, "shopping");
  assert.ok(shopping.japanese.includes("商品") || shopping.japanese.includes("いくら"));
  assert.ok(shopping.scenes.every((scene) => scene.sceneType && scene.tone && Array.isArray(scene.mediaRefs)));

  assert.equal(festival.theme, "festivals");
  assert.ok(festival.japanese.includes("祭り") || festival.translation.includes("Festival"));

  assert.equal(friendship.theme, "friendship");
  assert.ok(friendship.japanese.includes("友達") || friendship.translation.includes("friend"));

  assert.equal(transit.theme, "transit");
  assert.ok(transit.japanese.includes("電車") || transit.translation.includes("station"));
  assert.ok(transit.scenes.every((scene) => scene.sceneType && scene.tone && Array.isArray(scene.mediaRefs)));
});

test("lesson pack generation returns multiple imported lessons", () => {
  const pack = buildLessonPack("Travel Pack", "travel", 4);
  assert.equal(pack.length, 4);
  assert.equal(new Set(pack.map((lesson) => lesson.id)).size, 4);
  assert.ok(pack.every((lesson) => lesson.title.startsWith("Travel Pack")));
  assert.ok(pack.some((lesson) => lesson.japanese.includes("切符売り場")));
  assert.ok(pack.every((lesson) => Array.isArray(lesson.grammarPoints) && lesson.grammarPoints.length >= 2));
  assert.ok(pack.every((lesson) => Array.isArray(lesson.dialogueLines) && lesson.dialogueLines.length >= 3));
  assert.ok(pack.every((lesson) => Array.isArray(lesson.scenes) && lesson.scenes.length >= 3));
  assert.ok(pack.every((lesson) => Array.isArray(lesson.popCultureNotes) && lesson.popCultureNotes.length >= 2));
});

test("lesson pack generation handles the new curriculum themes", () => {
  const shoppingPack = buildLessonPack("Shopping Run", "shopping", 3);
  const festivalPack = buildLessonPack("Festival Night", "festivals", 2);
  const transitPack = buildLessonPack("Transit Announcements", "transit", 2);

  assert.equal(shoppingPack.length, 3);
  assert.ok(shoppingPack.every((lesson) => lesson.theme === "shopping"));
  assert.ok(shoppingPack.some((lesson) => lesson.translation.includes("How much") || lesson.japanese.includes("いくら")));

  assert.equal(festivalPack.length, 2);
  assert.ok(festivalPack.every((lesson) => lesson.theme === "festivals"));
  assert.ok(festivalPack.some((lesson) => lesson.translation.includes("Festival") || lesson.japanese.includes("祭り")));

  assert.equal(transitPack.length, 2);
  assert.ok(transitPack.every((lesson) => lesson.theme === "transit"));
  assert.ok(transitPack.some((lesson) => lesson.japanese.includes("電車") || lesson.translation.includes("train")));
});

test("scene blueprints and kanji breakdowns carry richer metadata", () => {
  const scenes = buildSceneBlueprint("festival", "Festival Night", "祭りの夜はとてもにぎやかです。", "Festival nights are very lively.", "Use の to attach the event to the time.");
  assert.equal(scenes.length, 3);
  assert.ok(scenes.every((scene) => scene.sceneType));
  assert.ok(scenes.every((scene) => scene.tone));
  assert.ok(scenes.every((scene) => Array.isArray(scene.mediaRefs)));

  const breakdowns = buildKanjiBreakdowns(["商", "買", "通"], "Shopping Run", "shopping", [
    { word: "商品", kana: "しょうひん" },
    { word: "買い物", kana: "かいもの" },
  ]);
  assert.equal(breakdowns.length, 3);
  assert.ok(breakdowns.every((entry) => Array.isArray(entry.radicals)));
  assert.ok(breakdowns.every((entry) => entry.strokeCount > 0));
  assert.ok(breakdowns.some((entry) => entry.lessonExamples.length > 0));
});

test("lesson catalog filters by query, theme, and difficulty", () => {
  const lessons = [
    buildLessonDraft("Train Station", "travel"),
    buildLessonDraft("Anime Scene", "anime"),
    buildLessonDraft("Polite Request", "etiquette"),
  ];
  assert.equal(filterLessonCatalog(lessons, "station").length, 1);
  assert.equal(filterLessonCatalog(lessons, "", "anime").length, 1);
  assert.equal(filterLessonCatalog(lessons, "", "", "N5").length >= 1, true);
  assert.equal(filterLessonCatalog(lessons, "request", "etiquette", "N5").length, 1);
});

test("moderation actions filter by query, status, type, and reviewer", () => {
  const actions = [
    { itemType: "lesson", itemId: "anime-intro", status: "published", reviewedBy: "admin", decisionReason: "Ready", notes: "Ship it", source: "manual" },
    { itemType: "kanji", itemId: "駅", status: "draft", reviewedBy: "editor", decisionReason: "Needs work", notes: "Fix reading", source: "import" },
  ];
  assert.deepEqual(filterModerationActions(actions, { query: "ship" }).map((item) => item.itemId), ["anime-intro"]);
  assert.deepEqual(filterModerationActions(actions, { status: "draft" }).map((item) => item.itemId), ["駅"]);
  assert.deepEqual(filterModerationActions(actions, { itemType: "kanji" }).map((item) => item.itemId), ["駅"]);
  assert.deepEqual(filterModerationActions(actions, { reviewer: "admin" }).map((item) => item.itemId), ["anime-intro"]);
});

test("next lesson helper prefers incomplete lessons", () => {
  const lessons = [
    buildLessonDraft("Train Station", "travel"),
    buildLessonDraft("Anime Scene", "anime"),
    buildLessonDraft("Polite Request", "etiquette"),
  ];
  const next = findNextLessonId(lessons, [lessons[0].id]);
  assert.equal(next, lessons[1].id);
  const fallback = findNextLessonId(lessons, lessons.map((lesson) => lesson.id), "anime-scene");
  assert.equal(fallback, "anime-scene");
});

test("lesson mastery checklist reflects completed and saved study state", () => {
  const lesson = buildLessonDraft("Train Station", "travel");
  const completedExercises = (lesson.exercises ?? []).map((exercise, index) => exercise.id ?? `${lesson.id}-exercise-${index + 1}`);
  const savedWords = (lesson.vocab ?? []).map((item) => ({ term: item.word, reading: item.kana }));
  const savedKanji = (lesson.kanji ?? []).map((character) => ({ character }));
  const kanjiReviews = (lesson.kanji ?? []).map((character) => ({ character }));
  const checklist = buildLessonProgressChecklist(
    lesson,
    {
      completedLessons: [lesson.id],
      completedExercises,
      lessonNotes: { [lesson.id]: "Remember polite requests." },
    },
    kanjiReviews,
    savedWords,
    savedKanji
  );
  assert.equal(checklist.length >= 5, true);
  assert.equal(checklist.every((item) => item.complete), true);
  assert.equal(checklist[0].label, "Complete lesson");
});

test("lesson exercise completion persists and awards study progress", () => {
  const temp = createTempStore();
  try {
    const before = temp.store.getSnapshot();
    assert.equal(Array.isArray(before.progress.completedExercises), true);
    const lesson = before.lessons.find((entry) => entry.id === "anime-intro");
    const exercise = lesson.exercises[0];
    const result = temp.store.recordPracticeSession("lesson-exercise", {
      lessonId: lesson.id,
      exerciseKey: exercise.id,
      exercise,
      selected: exercise.answer,
    });
    assert.equal(result.progress.completedExercises.includes(exercise.id), true);
    assert.equal(result.progress.xp > before.progress.xp, true);
    assert.equal(result.tutor.answer.includes("Correct"), true);
  } finally {
    cleanupTempStore(temp);
  }
});

test("lesson draft generation covers broader themes", () => {
  const daily = buildLessonDraft("Morning Routine", "daily life");
  const manga = buildLessonDraft("Panel Hook", "manga");
  const etiquette = buildLessonDraft("Polite Request", "etiquette");
  assert.equal(daily.theme, "daily life");
  assert.ok(daily.japanese.includes("駅") || daily.japanese.includes("朝ごはん"));
  assert.ok(manga.japanese.includes("コマ"));
  assert.ok(etiquette.translation.includes("Sorry for the trouble") || etiquette.translation.includes("please"));
  assert.ok(Array.isArray(daily.dialogueLines));
});

test("leaderboard is populated and updates from study progress", () => {
  const temp = createTempStore();
  try {
    const initial = temp.store.getSnapshot().admin.leaderboard;
    assert.ok(initial.length >= 1);
    assert.equal(initial[0].name, "You");

    temp.store.completeLesson("history-samurai");
    const updated = temp.store.getSnapshot().admin.leaderboard;
    assert.ok(updated.length >= 1);
    assert.ok(updated[0].xp > initial[0].xp);
  } finally {
    cleanupTempStore(temp);
  }
});

test("streak freezes protect the streak after a missed day", () => {
  const temp = createTempStore();
  try {
    temp.store.awardProgress({ xp: 0, credits: 60, streak: 0 }, "test-seed");
    temp.store.buyStreakFreeze();
    temp.store.db.prepare("UPDATE streak_state SET current_streak = ?, last_active_date = ?, freeze_count = ? WHERE id = 1")
      .run(12, "2000-01-01", 1);
    const task = temp.store.getSnapshot().dailyTasks.find((entry) => !entry.complete);
    assert.ok(task);
    const updated = temp.store.completeTask(task.id);
    assert.equal(updated.progress.streak, 12);
    assert.equal(updated.progress.streakFreezeCount, 0);
  } finally {
    cleanupTempStore(temp);
  }
});

test("challenges persist and can be claimed", () => {
  const temp = createTempStore();
  try {
    temp.store.db.prepare("UPDATE challenge_progress SET progress_count = ? WHERE challenge_id = ?").run(3, "challenge-anime-dialogue");
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
