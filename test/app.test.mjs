import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStorageAdapter } from "../db.mjs";
import { answerTutor, buildRoleplayTranscript, calculateLevel, escapeHtml, normalizeSentence, sm2Next } from "../shared.mjs";

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

test("review grading applies SM-2 updates and records history", () => {
  const temp = createTempStore();
  try {
    const before = temp.store.getReviews()[0];
    const graded = temp.store.gradeReview(before.id, 5);
    assert.ok(graded.interval_days >= 1);
    assert.ok(graded.ease >= before.ease);
    const historyCount = temp.store.db.prepare("SELECT COUNT(*) AS count FROM review_history WHERE review_item_id = ?").get(before.id).count;
    assert.equal(historyCount, 1);
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

    const speaking = temp.store.recordPracticeSession("speaking", { input: "ラーメンをください" });
    assert.equal(speaking.tutor.answer.startsWith("Natural correction:"), true);
    assert.equal(speaking.progress.speakingSessions >= 8, true);
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

test("shared helpers are deterministic and safe", () => {
  assert.equal(escapeHtml("<b>&</b>"), "&lt;b&gt;&amp;&lt;/b&gt;");
  assert.equal(normalizeSentence("ラーメンをください"), "ラーメンをください");
  assert.equal(normalizeSentence("今日は勉強します"), "今日は勉強します。");
  assert.equal(answerTutor("Explain particle usage"), "Use は for topic framing and が for focus or emphasis. In short: は sets the scene, が spotlights the subject.");
  assert.equal(buildRoleplayTranscript("travel").length, 4);
  const sm2Hard = sm2Next({ interval_days: 1, repetitions: 0, ease: 2.5, mistakes: 0 }, 2);
  const sm2Easy = sm2Next({ interval_days: 1, repetitions: 0, ease: 2.5, mistakes: 0 }, 5);
  assert.equal(sm2Hard.repetitions, 0);
  assert.equal(sm2Easy.repetitions, 1);
  assert.equal(sm2Easy.ease > sm2Hard.ease, true);
});
