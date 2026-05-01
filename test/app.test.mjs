import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStorageAdapter } from "../db.mjs";
import { answerAiFeature, answerTutor, buildLessonDraft, buildLessonPack, buildLessonProgressChecklist, buildRoleplayFollowUp, buildRoleplayTranscript, calculateLevel, chooseJapaneseVoice, escapeHtml, evaluateLessonExercise, evaluateListeningAnswer, evaluateSpeakingSubmission, evaluateWritingSubmission, filterLessonCatalog, findNextLessonId, normalizeSentence, sm2Next } from "../shared.mjs";

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
    assert.equal(snapshot.lessons.length, 3);
    assert.equal(snapshot.reviews.length, 3);
    assert.equal(snapshot.progress.xp, 1280);
    assert.equal(snapshot.progress.level, calculateLevel(snapshot.progress.xp));
    assert.equal(snapshot.admin.authenticated, false);
    assert.equal(snapshot.admin.roles.length, 4);
    assert.equal(temp.store.getSchemaVersion(), 12);
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
        return { ok: true };
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
      getPermissionMatrix() {
        return { roles: [], permissions: [] };
      },
      getUsers() {
        return [];
      },
      toggleStudyBookmark() {
        return { savedWords: [], savedKanji: [] };
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
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.exercises.length, 2);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "travel-station")?.dialogueLines.length, 3);

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
      grammarPoints: [{ title: "Greeting", explanation: "Use いらっしゃいませ as a welcome line.", example: "いらっしゃいませ。" }],
      dialogueLines: [{ speaker: "Clerk", text: "いらっしゃいませ。" }, { speaker: "Customer", text: "おすすめをください。" }],
      exercises: [{ type: "multiple-choice", prompt: "What does いらっしゃいませ mean?", choices: ["welcome", "thank you"], answer: "welcome", explanation: "It is a store greeting." }],
    });
    assert.equal(updated.length, 1);
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.title, "Anime: Store Greeting");
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.grammarPoints[0]?.title, "Greeting");
    assert.equal(temp.store.getLessons().find((lesson) => lesson.id === "imported-convenience-store")?.dialogueLines.length, 2);
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
    });
    assert.equal(result.dictionaryEntries, 1);
    assert.equal(result.kanjiEntries, 1);
    assert.equal(temp.store.lookupDictionary("感謝")?.meaning, "gratitude");
    assert.equal(temp.store.lookupKanji("駅")?.meaning, "station");
    assert.equal(temp.store.getSnapshot().admin.auditLog.some((entry) => entry.includes("Imported dataset bundle")), true);
  } finally {
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
    assert.equal(temp.store.getSchemaVersion(), 12);
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
    const cachedAi = await temp.store.aiResponse("grammar", "Explain より", { lessonTitle: "Samurai History" });
    assert.equal(cachedAi.cached, true);
    assert.equal(cachedAi.response, ai.response);

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
});

test("lesson pack generation returns multiple imported lessons", () => {
  const pack = buildLessonPack("Travel Pack", "travel", 4);
  assert.equal(pack.length, 4);
  assert.equal(new Set(pack.map((lesson) => lesson.id)).size, 4);
  assert.ok(pack.every((lesson) => lesson.title.startsWith("Travel Pack")));
  assert.ok(pack.some((lesson) => lesson.japanese.includes("切符売り場")));
  assert.ok(pack.every((lesson) => Array.isArray(lesson.grammarPoints) && lesson.grammarPoints.length >= 2));
  assert.ok(pack.every((lesson) => Array.isArray(lesson.dialogueLines) && lesson.dialogueLines.length >= 3));
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
