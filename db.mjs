import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ADMIN_CREDENTIALS, INITIAL_APP_STATE } from "./seed-data.mjs";
import { answerAiFeature, answerTutor, buildRoleplayTranscript, calculateLevel, normalizeSentence, sm2Next } from "./shared.mjs";

const DB_PATH = resolve(process.cwd(), "data", "learning-app.sqlite");

function nowIso() {
  return new Date().toISOString();
}

function currentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentWeekKey() {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now - firstDay) / 86400000) + 1;
  return `${now.getUTCFullYear()}-W${String(Math.ceil((dayOfYear + firstDay.getUTCDay()) / 7)).padStart(2, "0")}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function clone(value) {
  return structuredClone(value);
}

function normalizeLesson(lesson, index = 0) {
  return {
    id: lesson.id ?? `lesson-${index}`,
    title: lesson.title ?? "Untitled Lesson",
    theme: lesson.theme ?? "custom",
    difficulty: lesson.difficulty ?? "N5",
    japanese: lesson.japanese ?? "",
    romaji: lesson.romaji ?? "",
    translation: lesson.translation ?? "",
    grammar: lesson.grammar ?? "",
    vocab: Array.isArray(lesson.vocab) ? lesson.vocab : [],
    kanji: Array.isArray(lesson.kanji) ? lesson.kanji : [],
  };
}

function normalizeReviewItem(item, index = 0) {
  return {
    id: item.id ?? `review-${index}`,
    prompt: item.prompt ?? "",
    answer: item.answer ?? "",
    meaning: item.meaning ?? "",
    due: item.due ?? "Now",
    ease: Number(item.ease ?? 2.5),
    interval_days: Number(item.interval_days ?? 1),
    repetitions: Number(item.repetitions ?? 0),
    mistakes: Number(item.mistakes ?? 0),
    source_lesson_id: item.source_lesson_id ?? null,
  };
}

function normalizeAchievement(item) {
  return {
    name: item.name,
    unlocked: Boolean(item.unlocked),
  };
}

function normalizeTask(item) {
  return {
    id: item.id ?? (item.name ? `task-${String(item.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}` : "task-unknown"),
    name: item.name,
    reward: item.reward,
    complete: Boolean(item.complete),
  };
}

function normalizeCosmetic(item) {
  return {
    id: item.id ?? (item.name ? `cosmetic-${String(item.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}` : "cosmetic-unknown"),
    name: item.name,
    cost: Number(item.cost ?? 0),
    owned: Boolean(item.owned),
  };
}

function normalizeState(snapshot) {
  const state = clone(snapshot ?? INITIAL_APP_STATE);
  state.view ??= "learn";
  state.activeLessonId ??= state.lessons?.[0]?.id ?? "anime-intro";
  state.toggles ??= clone(INITIAL_APP_STATE.toggles);
  state.progress ??= clone(INITIAL_APP_STATE.progress);
  state.progress.completedLessons ??= [];
  state.lessons = Array.isArray(state.lessons) ? state.lessons.map(normalizeLesson) : [];
  state.reviews = Array.isArray(state.reviews) ? state.reviews.map(normalizeReviewItem) : [];
  state.achievements = Array.isArray(state.achievements) ? state.achievements.map(normalizeAchievement) : [];
  state.dailyTasks = Array.isArray(state.dailyTasks) ? state.dailyTasks.map(normalizeTask) : [];
  state.cosmetics = Array.isArray(state.cosmetics) ? state.cosmetics.map(normalizeCosmetic) : [];
  state.admin ??= clone(INITIAL_APP_STATE.admin);
  state.admin.roles ??= [];
  state.admin.aiUsage ??= clone(INITIAL_APP_STATE.admin.aiUsage);
  state.admin.siteHealth ??= "Green";
  state.admin.maintenanceMode ??= false;
  state.admin.announcements ??= "";
  state.admin.authenticated ??= false;
  state.admin.sessionUser ??= null;
  state.admin.auditLog ??= [];
  state.admin.contentReviewQueue ??= [];
  state.admin.permissions ??= {};
  state.admin.users ??= Array.isArray(state.users) ? state.users : [];
  state.roleplay ??= clone(INITIAL_APP_STATE.roleplay);
  state.tutor ??= clone(INITIAL_APP_STATE.tutor);
  state.chest ??= clone(INITIAL_APP_STATE.chest);
  return state;
}

function normalizeUser(item, index = 0) {
  return {
    id: item.id ?? `user-${index + 1}`,
    username: item.username ?? `user${index + 1}`,
    email: item.email ?? `${item.username ?? `user${index + 1}`}@example.com`,
    level: Number(item.level ?? 1),
    status: item.status ?? "active",
    credits: Number(item.credits ?? 0),
    streak: Number(item.streak ?? 0),
    createdAt: item.createdAt ?? nowIso(),
    updatedAt: item.updatedAt ?? nowIso(),
  };
}

function applyAchievementRules(state) {
  const unlock = (name, condition) => {
    const achievement = state.achievements.find((item) => item.name === name);
    if (achievement && condition) {
      achievement.unlocked = true;
    }
  };

  unlock("First Lesson Completed", state.progress.completedLessons.length > 0);
  unlock("7-Day Streak", state.progress.streak >= 7);
  unlock("50 Kanji Learned", state.progress.kanji >= 50);
  unlock("100 Words Reviewed", state.progress.reviewedWords >= 100);
  unlock("First Spoken Conversation", state.progress.speakingSessions >= 1);
  unlock("Anime Dialogue Master", state.progress.completedLessons.includes("anime-intro"));

  return state;
}

function getSchemaVersion(db) {
  const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get();
  return Number(row?.value ?? 0);
}

function setSchemaVersion(db, version) {
  db.prepare("INSERT INTO schema_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(version));
}

function parseRewardText(text) {
  const xpMatch = String(text).match(/\+(\d+)\s*XP/i);
  const creditMatch = String(text).match(/\+(\d+)\s*credits?/i);
  return {
    xp: xpMatch ? Number(xpMatch[1]) : 0,
    credits: creditMatch ? Number(creditMatch[1]) : 0,
  };
}

export class SqliteStorageAdapter {
  constructor(filePath = DB_PATH) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
    this.seedIfNeeded();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        view TEXT NOT NULL,
        active_lesson_id TEXT NOT NULL,
        toggles_json TEXT NOT NULL,
        roleplay_json TEXT NOT NULL,
        tutor_json TEXT NOT NULL,
        chest_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS progress_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        xp INTEGER NOT NULL,
        level INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        streak INTEGER NOT NULL,
        kanji INTEGER NOT NULL,
        vocab INTEGER NOT NULL,
        speaking_minutes INTEGER NOT NULL,
        listening_minutes INTEGER NOT NULL,
        completed_lessons_json TEXT NOT NULL,
        reviewed_words INTEGER NOT NULL,
        speaking_sessions INTEGER NOT NULL,
        listening_exercises INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        theme TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        japanese TEXT NOT NULL,
        romaji TEXT NOT NULL,
        translation TEXT NOT NULL,
        grammar TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS lesson_vocab (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        word TEXT NOT NULL,
        kana TEXT NOT NULL,
        meaning TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lesson_kanji (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        kanji TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lesson_grammar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        explanation TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lesson_dialogue_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        speaker TEXT NOT NULL,
        text TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS exercise_items (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        choices_json TEXT NOT NULL,
        answer TEXT NOT NULL,
        explanation TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS review_items (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        answer TEXT NOT NULL,
        meaning TEXT NOT NULL,
        due TEXT NOT NULL,
        ease REAL NOT NULL,
        interval_days INTEGER NOT NULL DEFAULT 1,
        repetitions INTEGER NOT NULL DEFAULT 0,
        mistakes INTEGER NOT NULL DEFAULT 0,
        source_lesson_id TEXT,
        FOREIGN KEY (source_lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS review_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_item_id TEXT NOT NULL,
        grade INTEGER NOT NULL,
        reviewed_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (review_item_id) REFERENCES review_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS progress_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xp INTEGER NOT NULL,
        level INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        streak INTEGER NOT NULL,
        kanji INTEGER NOT NULL,
        vocab INTEGER NOT NULL,
        speaking_minutes INTEGER NOT NULL,
        listening_minutes INTEGER NOT NULL,
        reviewed_words INTEGER NOT NULL,
        speaking_sessions INTEGER NOT NULL,
        listening_exercises INTEGER NOT NULL,
        completed_lessons_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        xp_delta INTEGER NOT NULL,
        credits_delta INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS xp_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credits_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        achievement_id TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL,
        FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS daily_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reward TEXT NOT NULL,
        reward_xp INTEGER NOT NULL,
        reward_credits INTEGER NOT NULL,
        target_count INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS task_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        date_key TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS streak_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_streak INTEGER NOT NULL,
        last_active_date TEXT NOT NULL,
        freeze_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cosmetics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cost INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_cosmetics (
        cosmetic_id TEXT PRIMARY KEY,
        owned_at TEXT NOT NULL,
        equipped INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        announcements TEXT NOT NULL,
        maintenance_mode INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_usage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'local',
        requests INTEGER NOT NULL,
        token_estimate INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_review_queue (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        level INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        credits INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dictionary_entries (
        id TEXT PRIMARY KEY,
        term TEXT NOT NULL,
        reading TEXT NOT NULL,
        meaning TEXT NOT NULL,
        part_of_speech TEXT NOT NULL,
        example TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'seed'
      );
    `);
    if (getSchemaVersion(this.db) < 1) setSchemaVersion(this.db, 1);
    if (getSchemaVersion(this.db) < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          level INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          credits INTEGER NOT NULL DEFAULT 0,
          streak INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      setSchemaVersion(this.db, 2);
    }
    if (getSchemaVersion(this.db) < 3) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS dictionary_entries (
          id TEXT PRIMARY KEY,
          term TEXT NOT NULL,
          reading TEXT NOT NULL,
          meaning TEXT NOT NULL,
          part_of_speech TEXT NOT NULL,
          example TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'seed'
        );
      `);
      setSchemaVersion(this.db, 3);
    }
  }

  seedIfNeeded() {
    const lessonCount = this.db.prepare("SELECT COUNT(*) AS count FROM lessons").get().count;
    if (lessonCount > 0) return;
    const snapshot = normalizeState(INITIAL_APP_STATE);
    this.replaceMirrorTables(snapshot);
    this.db.prepare(
      "INSERT OR REPLACE INTO admin_users (id, username, password_hash, role_name, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("admin-1", ADMIN_CREDENTIALS.username, sha256(ADMIN_CREDENTIALS.password), "Super Admin", nowIso());
    snapshot.admin.users.forEach((user, index) => {
      const normalized = normalizeUser(user, index);
      this.db.prepare(
        "INSERT OR REPLACE INTO users (id, username, email, level, status, credits, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        normalized.id,
        normalized.username,
        normalized.email,
        normalized.level,
        normalized.status,
        normalized.credits,
        normalized.streak,
        normalized.createdAt,
        normalized.updatedAt
      );
    });
    const roles = [
      ["role-super-admin", "Super Admin"],
      ["role-content-admin", "Content Admin"],
      ["role-support-admin", "Support Admin"],
      ["role-analytics-admin", "Analytics Admin"],
    ];
    roles.forEach(([id, name]) => {
      this.db.prepare("INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)").run(id, name);
    });
    const permissions = [
      ["perm-content", "Manage content"],
      ["perm-users", "Manage users"],
      ["perm-analytics", "View analytics"],
      ["perm-ai", "Manage AI usage"],
    ];
    permissions.forEach(([id, name]) => {
      this.db.prepare("INSERT OR IGNORE INTO permissions (id, name) VALUES (?, ?)").run(id, name);
    });
    const rolePermissions = [
      ["role-super-admin", "perm-content"],
      ["role-super-admin", "perm-users"],
      ["role-super-admin", "perm-analytics"],
      ["role-super-admin", "perm-ai"],
      ["role-content-admin", "perm-content"],
      ["role-content-admin", "perm-ai"],
      ["role-support-admin", "perm-users"],
      ["role-analytics-admin", "perm-analytics"],
    ];
    rolePermissions.forEach(([roleId, permissionId]) => {
      this.db
        .prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)")
        .run(roleId, permissionId);
    });
    for (let index = 0; index < snapshot.admin.aiUsage.dailyRequests; index += 1) {
      this.db.prepare(
        "INSERT INTO ai_usage_log (feature, user_id, requests, token_estimate, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run("initial-seed", "local", 1, 120, nowIso());
    }

    const dictionaryRows = new Map();
    snapshot.lessons.forEach((lesson) => {
      lesson.vocab.forEach((item, index) => {
        const key = `${item.word}-${item.kana}`.toLowerCase();
        dictionaryRows.set(key, {
          id: `dict-${lesson.id}-${index + 1}`,
          term: item.word,
          reading: item.kana,
          meaning: item.meaning,
          part_of_speech: "noun",
          example: lesson.translation,
        });
      });
      lesson.kanji.forEach((kanji, index) => {
        const key = `${kanji}-kanji`;
        dictionaryRows.set(key, {
          id: `dict-${lesson.id}-kanji-${index + 1}`,
          term: kanji,
          reading: "",
          meaning: `${kanji} used in lesson context`,
          part_of_speech: "kanji",
          example: lesson.japanese,
        });
      });
    });
    Array.from(dictionaryRows.values()).forEach((entry) => {
      this.db.prepare(
        "INSERT OR REPLACE INTO dictionary_entries (id, term, reading, meaning, part_of_speech, example, source) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(entry.id, entry.term, entry.reading, entry.meaning, entry.part_of_speech, entry.example, "seed");
    });
  }

  close() {
    this.db.close();
  }

  loadLessons() {
    return this.getSnapshot().lessons;
  }

  createLesson(lesson) {
    const next = this.getSnapshot();
    const normalized = normalizeLesson(lesson, next.lessons.length);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.insertLessonRow(normalized, next.lessons.length);
      this.db.prepare("INSERT INTO audit_log (entry, created_at) VALUES (?, ?)").run(`Created lesson: ${normalized.title}`, nowIso());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return normalized;
  }

  updateLesson(lessonId, patch) {
    const current = this.db.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId);
    if (!current) return null;
    const lesson = normalizeLesson({
      id: lessonId,
      title: patch.title ?? current.title,
      theme: patch.theme ?? current.theme,
      difficulty: patch.difficulty ?? current.difficulty,
      japanese: patch.japanese ?? current.japanese,
      romaji: patch.romaji ?? current.romaji,
      translation: patch.translation ?? current.translation,
      grammar: patch.grammar ?? current.grammar,
      vocab: Array.isArray(patch.vocab) ? patch.vocab : this.loadLessonVocab(lessonId),
      kanji: Array.isArray(patch.kanji) ? patch.kanji : this.loadLessonKanji(lessonId),
    });
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        "UPDATE lessons SET title = ?, theme = ?, difficulty = ?, japanese = ?, romaji = ?, translation = ?, grammar = ? WHERE id = ?"
      ).run(lesson.title, lesson.theme, lesson.difficulty, lesson.japanese, lesson.romaji, lesson.translation, lesson.grammar, lessonId);
      this.replaceLessonChildren(lessonId, lesson);
      this.db.prepare("INSERT INTO audit_log (entry, created_at) VALUES (?, ?)").run(`Updated lesson: ${lesson.title}`, nowIso());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return lesson;
  }

  deleteLesson(lessonId) {
    const lesson = this.db.prepare("SELECT title FROM lessons WHERE id = ?").get(lessonId);
    if (!lesson) return false;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM lessons WHERE id = ?").run(lessonId);
      this.db.prepare("DELETE FROM review_items WHERE source_lesson_id = ?").run(lessonId);
      this.db.prepare("INSERT INTO audit_log (entry, created_at) VALUES (?, ?)").run(`Deleted lesson: ${lesson.title}`, nowIso());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return true;
  }

  upsertLesson(lesson) {
    const snapshot = this.getSnapshot();
    const next = clone(snapshot);
    const normalized = normalizeLesson(lesson, next.lessons.length);
    const existingIndex = next.lessons.findIndex((item) => item.id === normalized.id);
    if (existingIndex >= 0) next.lessons[existingIndex] = normalized;
    else next.lessons.push(normalized);
    this.saveAppState(next);
    return normalized;
  }

  loadReviews() {
    return this.getSnapshot().reviews;
  }

  saveReviewItems(items) {
    const snapshot = this.getSnapshot();
    snapshot.reviews = Array.isArray(items) ? items.map(normalizeReviewItem) : [];
    this.saveAppState(snapshot);
    return snapshot.reviews;
  }

  gradeReview(reviewId, grade) {
    const review = this.db.prepare("SELECT * FROM review_items WHERE id = ?").get(reviewId);
    if (!review) return null;
    const next = sm2Next(review, grade);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        "UPDATE review_items SET due = ?, ease = ?, interval_days = ?, repetitions = ?, mistakes = ? WHERE id = ?"
      ).run(next.due, next.ease, next.interval_days, next.repetitions, next.mistakes, reviewId);
      this.db.prepare(
        "INSERT INTO review_history (review_item_id, grade, reviewed_at, note) VALUES (?, ?, ?, ?)"
      ).run(reviewId, grade, nowIso(), grade >= 4 ? "good" : "retry");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    const current = this.getSnapshot();
    const updated = {
      ...current,
      progress: {
        ...current.progress,
        reviewedWords: current.progress.reviewedWords + 1,
      },
    };
    this.saveAppState(updated, current.admin.sessionUser ?? null);
    return { ...review, ...next };
  }

  loadProgress() {
    return this.getSnapshot().progress;
  }

  saveProgress(progress) {
    const snapshot = this.getSnapshot();
    snapshot.progress = {
      ...snapshot.progress,
      ...progress,
      completedLessons: Array.isArray(progress.completedLessons)
        ? progress.completedLessons
        : snapshot.progress.completedLessons,
    };
    this.saveAppState(snapshot);
    return snapshot.progress;
  }

  awardProgress(delta, source = "manual") {
    const current = this.getSnapshot();
    const next = {
      ...current,
      progress: {
        ...current.progress,
        xp: current.progress.xp + Number(delta.xp || 0),
        credits: current.progress.credits + Number(delta.credits || 0),
        streak: Math.max(0, current.progress.streak + Number(delta.streak || 0)),
      },
    };
    this.saveAppState(next, current.admin.sessionUser ?? null);
    this.appendAudit(`${source}: progress delta`);
    return this.getSnapshot();
  }

  completeLesson(lessonId, sessionUser = null) {
    const current = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    if (current.progress.completedLessons.includes(lessonId)) {
      return current;
    }
    const updated = {
      ...current,
      progress: {
        ...current.progress,
        xp: current.progress.xp + 80,
        credits: current.progress.credits + 20,
        reviewedWords: current.progress.reviewedWords + 3,
        kanji: current.progress.kanji + 2,
        completedLessons: [...current.progress.completedLessons, lessonId],
      },
    };
    this.saveAppState(updated, sessionUser ?? current.admin.sessionUser ?? null);
    this.appendAudit(`Completed lesson: ${lessonId}`);
    return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
  }

  completeTask(taskId, sessionUser = null) {
    const current = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    const task = this.db.prepare("SELECT * FROM daily_tasks WHERE id = ?").get(taskId);
    if (!task) return null;
    const existing = this.db
      .prepare("SELECT 1 FROM task_completions WHERE task_id = ? AND date_key = ?")
      .get(taskId, currentDateKey());
    if (existing) {
      return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO task_completions (task_id, completed_at, date_key) VALUES (?, ?, ?)")
        .run(taskId, nowIso(), currentDateKey());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    const updated = {
      ...current,
      progress: {
        ...current.progress,
        xp: current.progress.xp + task.reward_xp,
        credits: current.progress.credits + task.reward_credits,
        streak: current.progress.streak + 1,
      },
    };
    this.saveAppState(updated, sessionUser ?? current.admin.sessionUser ?? null);
    this.appendAudit(`Completed task: ${task.name}`);
    return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
  }

  buyCosmetic(cosmeticId, sessionUser = null) {
    const current = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    const cosmetic = this.db.prepare("SELECT * FROM cosmetics WHERE id = ?").get(cosmeticId);
    if (!cosmetic) return null;
    if (this.db.prepare("SELECT 1 FROM user_cosmetics WHERE cosmetic_id = ?").get(cosmeticId)) {
      return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    }
    if (current.progress.credits < cosmetic.cost) {
      throw new Error("Not enough credits");
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO user_cosmetics (cosmetic_id, owned_at, equipped) VALUES (?, ?, ?)")
        .run(cosmeticId, nowIso(), 0);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    const updated = {
      ...current,
      progress: {
        ...current.progress,
        credits: current.progress.credits - cosmetic.cost,
      },
    };
    this.saveAppState(updated, sessionUser ?? current.admin.sessionUser ?? null);
    this.appendAudit(`Purchased cosmetic: ${cosmetic.name}`);
    return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
  }

  recordPracticeSession(kind, payload = {}, sessionUser = null) {
    const current = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    const updated = clone(current);
    let audit = "";

    if (kind === "speaking") {
      const correction = answerAiFeature("correction", payload.input ?? "", {});
      updated.tutor.answer = correction;
      updated.progress.speakingMinutes += 4;
      updated.progress.speakingSessions += 1;
      updated.progress.xp += 30;
      updated.progress.credits += 10;
      audit = `Speaking practice: ${correction}`;
    } else if (kind === "listening") {
      const correct = payload.answer === "soup";
      if (correct) {
        updated.progress.listeningMinutes += 3;
        updated.progress.listeningExercises += 1;
        updated.progress.xp += 20;
        updated.progress.credits += 5;
      }
      audit = `Listening practice: ${correct ? "correct" : "incorrect"}`;
    } else if (kind === "writing") {
      const sentence = String(payload.input ?? "");
      const feedback = answerAiFeature("writing", sentence, {});
      updated.tutor.answer = feedback;
      updated.progress.xp += 25;
      updated.progress.credits += 8;
      audit = `Writing practice reviewed`;
    } else if (kind === "tutor") {
      const question = String(payload.question ?? current.tutor.question);
      updated.tutor.question = question;
      updated.tutor.answer = answerAiFeature("tutor", question, {});
      updated.progress.xp += 15;
      audit = `Tutor question answered`;
    } else if (kind === "roleplay") {
      const scenario = String(payload.scenario ?? current.roleplay.scenario);
      updated.roleplay.scenario = scenario;
      updated.roleplay.transcript = answerAiFeature("roleplay", scenario, { scenario })
        .split("\n")
        .map((line, index) => {
          const [speaker, ...rest] = line.split(": ");
          return {
            speaker: speaker || ["System", "You", "Server", "You"][index] || "System",
            text: rest.join(": ") || line,
          };
        });
      updated.progress.xp += 20;
      updated.progress.credits += 5;
      audit = `Roleplay scenario updated: ${scenario}`;
    } else {
      throw new Error(`Unsupported practice kind: ${kind}`);
    }

    this.saveAppState(updated, sessionUser ?? current.admin.sessionUser ?? null);
    this.appendAudit(audit);
    return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
  }

  loadAdminState(sessionUser = null) {
    return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser }).admin;
  }

  saveAdminState(admin, sessionUser = null) {
    const snapshot = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    snapshot.admin = {
      ...snapshot.admin,
      ...admin,
      authenticated: Boolean(sessionUser),
      sessionUser: sessionUser ?? null,
    };
    this.saveAppState(snapshot, sessionUser);
    return snapshot.admin;
  }

  updateSettings(settings, sessionUser = null) {
    const current = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    current.admin.announcements = settings.announcements ?? current.admin.announcements;
    current.admin.maintenanceMode = Boolean(settings.maintenanceMode ?? current.admin.maintenanceMode);
    current.admin.siteHealth = current.admin.maintenanceMode ? "Amber" : "Green";
    return this.saveAppState(current, sessionUser).admin;
  }

  recordAiUsage(feature, requests = 1, tokenEstimate = 0, userId = "local") {
    this.db.prepare(
      "INSERT INTO ai_usage_log (feature, user_id, requests, token_estimate, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(feature, userId, requests, tokenEstimate, nowIso());
    return this.getAiUsage();
  }

  appendAudit(entry) {
    this.db.prepare("INSERT INTO audit_log (entry, created_at) VALUES (?, ?)").run(entry, nowIso());
    return this.getAuditLog();
  }

  claimRewardChest() {
    const current = this.getSnapshot();
    const rewards = ["+60 XP", "+15 credits", "Rare badge: Ramen Star", "Cosmetic token: Shrine Night"];
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    const parsed = parseRewardText(reward);
    const next = {
      ...current,
      progress: {
        ...current.progress,
        xp: current.progress.xp + parsed.xp,
        credits: current.progress.credits + parsed.credits + (parsed.xp === 0 && parsed.credits === 0 ? 25 : 0),
      },
      chest: { ready: true, lastReward: reward },
    };
    this.saveAppState(next, current.admin.sessionUser ?? null);
    this.appendAudit(`Opened reward chest: ${reward}`);
    return { reward, state: this.getSnapshot() };
  }

  getSnapshot(session = { authenticated: false, sessionUser: null }) {
    const stateRow = this.db.prepare("SELECT * FROM app_state WHERE id = 1").get();
    const progressRow = this.db.prepare("SELECT * FROM progress_state WHERE id = 1").get();
    const settingsRow = this.db.prepare("SELECT * FROM site_settings WHERE id = 1").get();
    const streakRow = this.db.prepare("SELECT * FROM streak_state WHERE id = 1").get();
    const lessons = this.db.prepare("SELECT * FROM lessons ORDER BY order_index, title").all().map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      theme: lesson.theme,
      difficulty: lesson.difficulty,
      japanese: lesson.japanese,
      romaji: lesson.romaji,
      translation: lesson.translation,
      grammar: lesson.grammar,
      vocab: this.db
        .prepare("SELECT word, kana, meaning FROM lesson_vocab WHERE lesson_id = ? ORDER BY order_index, id")
        .all(lesson.id),
      kanji: this.db
        .prepare("SELECT kanji FROM lesson_kanji WHERE lesson_id = ? ORDER BY order_index, id")
        .all(lesson.id)
        .map((row) => row.kanji),
    }));
    const reviews = this.db.prepare("SELECT * FROM review_items ORDER BY due, id").all().map((row) => ({
      id: row.id,
      prompt: row.prompt,
      answer: row.answer,
      meaning: row.meaning,
      due: row.due,
      ease: row.ease,
      interval_days: row.interval_days,
      repetitions: row.repetitions,
      mistakes: row.mistakes,
      source_lesson_id: row.source_lesson_id,
    }));
    const achievements = this.db.prepare("SELECT * FROM achievements ORDER BY sort_order, name").all().map((row) => ({
      name: row.name,
      unlocked: Boolean(
        this.db.prepare("SELECT 1 FROM user_achievements WHERE achievement_id = ?").get(row.id)
      ),
    }));
    const dailyTasks = this.db.prepare("SELECT * FROM daily_tasks ORDER BY sort_order, name").all().map((row) => ({
      id: row.id,
      name: row.name,
      reward: row.reward,
      complete: Boolean(
        this.db
          .prepare("SELECT 1 FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1")
          .get(row.id)
      ),
    }));
    const cosmetics = this.db.prepare("SELECT * FROM cosmetics ORDER BY sort_order, name").all().map((row) => ({
      id: row.id,
      name: row.name,
      cost: row.cost,
      owned: Boolean(this.db.prepare("SELECT 1 FROM user_cosmetics WHERE cosmetic_id = ?").get(row.id)),
    }));
    const aiRows = this.db.prepare("SELECT * FROM ai_usage_log ORDER BY id DESC").all();
    const today = currentDateKey();
    const aiUsage = aiRows.length
      ? {
          dailyRequests: aiRows.filter((row) => row.created_at.slice(0, 10) === today).length,
          monthlyRequests: aiRows.length,
          cachedResponses: Math.max(0, 124 + aiRows.length),
          failedRequests: aiRows.filter((row) => row.feature.includes("failed")).length,
        }
      : {
          dailyRequests: 0,
          monthlyRequests: 0,
          cachedResponses: 0,
          failedRequests: 0,
        };
    const adminRoles = this.db.prepare("SELECT name FROM roles ORDER BY name").all().map((row) => row.name);
    const permissions = this.getPermissionMatrix();
    const auditLog = this.db.prepare("SELECT entry FROM audit_log ORDER BY id DESC LIMIT 25").all().map((row) => row.entry);
    const users = this.db.prepare("SELECT * FROM users ORDER BY level DESC, username").all().map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      level: row.level,
      status: row.status,
      credits: row.credits,
      streak: row.streak,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    const contentReviewQueue = this.db.prepare("SELECT * FROM content_review_queue ORDER BY created_at DESC, id DESC").all().map((row) => ({
      id: row.id,
      itemType: row.item_type,
      itemId: row.item_id,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    }));
    const appState = {
      ...(stateRow ? {
        view: stateRow.view,
        activeLessonId: stateRow.active_lesson_id,
        toggles: parseJson(stateRow.toggles_json, clone(INITIAL_APP_STATE.toggles)),
        roleplay: parseJson(stateRow.roleplay_json, clone(INITIAL_APP_STATE.roleplay)),
        tutor: parseJson(stateRow.tutor_json, clone(INITIAL_APP_STATE.tutor)),
        chest: parseJson(stateRow.chest_json, clone(INITIAL_APP_STATE.chest)),
      } : clone(INITIAL_APP_STATE)),
    };
    const progress = progressRow
      ? {
          xp: progressRow.xp,
          level: calculateLevel(progressRow.xp),
          credits: progressRow.credits,
          streak: progressRow.streak,
          kanji: progressRow.kanji,
          vocab: progressRow.vocab,
          speakingMinutes: progressRow.speaking_minutes,
          listeningMinutes: progressRow.listening_minutes,
          completedLessons: parseJson(progressRow.completed_lessons_json, []),
          reviewedWords: progressRow.reviewed_words,
          speakingSessions: progressRow.speaking_sessions,
          listeningExercises: progressRow.listening_exercises,
        }
      : clone(INITIAL_APP_STATE.progress);
    const siteSettings = settingsRow
      ? {
          announcements: settingsRow.announcements,
          maintenanceMode: Boolean(settingsRow.maintenance_mode),
        }
      : {
          announcements: INITIAL_APP_STATE.admin.announcements,
          maintenanceMode: INITIAL_APP_STATE.admin.maintenanceMode,
        };
    const admin = {
      roles: adminRoles.length ? adminRoles : clone(INITIAL_APP_STATE.admin.roles),
      aiUsage,
      siteHealth: siteSettings.maintenanceMode ? "Amber" : "Green",
      maintenanceMode: siteSettings.maintenanceMode,
      announcements: siteSettings.announcements,
      authenticated: Boolean(session?.authenticated),
      sessionUser: session?.sessionUser ?? null,
      auditLog,
      contentReviewQueue,
      permissions,
      users,
    };
    const streakState = streakRow
      ? streakRow
      : { current_streak: progress.streak, last_active_date: currentDateKey(), freeze_count: 0 };

    return normalizeState({
      ...appState,
      progress: {
        ...progress,
        streak: streakState.current_streak,
      },
      lessons,
      reviews,
      achievements,
      dailyTasks,
      cosmetics,
      admin,
    });
  }

  saveAppState(nextSnapshot, sessionUser = null) {
    const next = applyAchievementRules(normalizeState(nextSnapshot));
    next.progress.level = calculateLevel(next.progress.xp);
    const current = this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
    const xpDelta = next.progress.xp - current.progress.xp;
    const creditDelta = next.progress.credits - current.progress.credits;
    const now = nowIso();

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.replaceMirrorTables(next);

      if (xpDelta !== 0) {
        this.db.prepare("INSERT INTO xp_events (source, amount, created_at) VALUES (?, ?, ?)").run(
          "state-sync",
          xpDelta,
          now
        );
      }
      if (creditDelta !== 0) {
        this.db.prepare("INSERT INTO credits_ledger (source, amount, created_at) VALUES (?, ?, ?)").run(
          "state-sync",
          creditDelta,
          now
        );
      }
      this.db.prepare(
        "INSERT INTO progress_snapshots (xp, level, credits, streak, kanji, vocab, speaking_minutes, listening_minutes, reviewed_words, speaking_sessions, listening_exercises, completed_lessons_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        next.progress.xp,
        next.progress.level,
        next.progress.credits,
        next.progress.streak,
        next.progress.kanji,
        next.progress.vocab,
        next.progress.speakingMinutes,
        next.progress.listeningMinutes,
        next.progress.reviewedWords,
        next.progress.speakingSessions,
        next.progress.listeningExercises,
        toJson(next.progress.completedLessons),
        now
      );
      this.db.prepare(
        "INSERT INTO leaderboard_snapshots (week_key, payload_json, created_at) VALUES (?, ?, ?)"
      ).run(
        currentWeekKey(),
        toJson([
          { name: "You", xp: next.progress.xp, track: "Local" },
          { name: "Mika", xp: 1110, track: "Speaking" },
          { name: "Ren", xp: 980, track: "Kanji" },
          { name: "Yui", xp: 930, track: "Listening" },
        ]),
        now
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return this.getSnapshot({ authenticated: Boolean(sessionUser), sessionUser });
  }

  replaceMirrorTables(snapshot) {
    this.db.exec(`
      DELETE FROM app_state;
      DELETE FROM progress_state;
      DELETE FROM lessons;
      DELETE FROM lesson_vocab;
      DELETE FROM lesson_kanji;
      DELETE FROM lesson_grammar;
      DELETE FROM lesson_dialogue_lines;
      DELETE FROM exercise_items;
      DELETE FROM achievements;
      DELETE FROM user_achievements;
      DELETE FROM daily_tasks;
      DELETE FROM task_completions;
      DELETE FROM streak_state;
      DELETE FROM cosmetics;
      DELETE FROM user_cosmetics;
      DELETE FROM site_settings;
      DELETE FROM content_review_queue;
      DELETE FROM users;
      DELETE FROM dictionary_entries;
    `);

    this.db.prepare(
      "INSERT INTO app_state (id, view, active_lesson_id, toggles_json, roleplay_json, tutor_json, chest_json) VALUES (1, ?, ?, ?, ?, ?, ?)"
    ).run(
      snapshot.view,
      snapshot.activeLessonId,
      toJson(snapshot.toggles),
      toJson(snapshot.roleplay),
      toJson(snapshot.tutor),
      toJson(snapshot.chest)
    );

    this.db.prepare(
      "INSERT INTO progress_state (id, xp, level, credits, streak, kanji, vocab, speaking_minutes, listening_minutes, completed_lessons_json, reviewed_words, speaking_sessions, listening_exercises) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      snapshot.progress.xp,
      calculateLevel(snapshot.progress.xp),
      snapshot.progress.credits,
      snapshot.progress.streak,
      snapshot.progress.kanji,
      snapshot.progress.vocab,
      snapshot.progress.speakingMinutes,
      snapshot.progress.listeningMinutes,
      toJson(snapshot.progress.completedLessons),
      snapshot.progress.reviewedWords,
      snapshot.progress.speakingSessions,
      snapshot.progress.listeningExercises
    );

    snapshot.lessons.forEach((lesson, orderIndex) => {
      this.db.prepare(
        "INSERT INTO lessons (id, title, theme, difficulty, japanese, romaji, translation, grammar, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(lesson.id, lesson.title, lesson.theme, lesson.difficulty, lesson.japanese, lesson.romaji, lesson.translation, lesson.grammar, orderIndex);
      lesson.vocab.forEach((item, vocabIndex) => {
        this.db.prepare("INSERT INTO lesson_vocab (lesson_id, word, kana, meaning, order_index) VALUES (?, ?, ?, ?, ?)")
          .run(lesson.id, item.word, item.kana, item.meaning, vocabIndex);
      });
      lesson.kanji.forEach((kanji, kanjiIndex) => {
        this.db.prepare("INSERT INTO lesson_kanji (lesson_id, kanji, order_index) VALUES (?, ?, ?)")
          .run(lesson.id, kanji, kanjiIndex);
      });
      this.db.prepare("INSERT INTO lesson_grammar (lesson_id, explanation, order_index) VALUES (?, ?, ?)")
        .run(lesson.id, lesson.grammar, 0);
      this.db.prepare("INSERT INTO lesson_dialogue_lines (lesson_id, speaker, text, order_index) VALUES (?, ?, ?, ?)")
        .run(lesson.id, "Narration", lesson.japanese, 0);
      this.db.prepare(
        "INSERT INTO exercise_items (id, lesson_id, type, prompt, choices_json, answer, explanation, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        `${lesson.id}-exercise`,
        lesson.id,
        "multiple-choice",
        `Which meaning best fits: ${lesson.japanese}`,
        toJson([lesson.translation, lesson.grammar, lesson.theme]),
        lesson.translation,
        lesson.grammar,
        0
      );
    });

    const existingReviewIds = new Set(
      this.db.prepare("SELECT id FROM review_items").all().map((row) => row.id)
    );
    snapshot.reviews.forEach((item) => {
      this.db.prepare(
        `
          INSERT INTO review_items (id, prompt, answer, meaning, due, ease, interval_days, repetitions, mistakes, source_lesson_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            prompt = excluded.prompt,
            answer = excluded.answer,
            meaning = excluded.meaning,
            due = excluded.due,
            ease = excluded.ease,
            interval_days = excluded.interval_days,
            repetitions = excluded.repetitions,
            mistakes = excluded.mistakes,
            source_lesson_id = excluded.source_lesson_id
        `
      ).run(
        item.id,
        item.prompt,
        item.answer,
        item.meaning,
        item.due,
        item.ease,
        item.interval_days ?? 1,
        item.repetitions ?? 0,
        item.mistakes ?? 0,
        item.source_lesson_id ?? snapshot.lessons.find((lesson) => lesson.id === snapshot.activeLessonId)?.id ?? null
      );
      existingReviewIds.delete(item.id);
    });
    existingReviewIds.forEach((reviewId) => {
      this.db.prepare("DELETE FROM review_items WHERE id = ?").run(reviewId);
    });

    snapshot.achievements.forEach((achievement, index) => {
      const id = `achievement-${index + 1}`;
      this.db.prepare("INSERT INTO achievements (id, name, description, sort_order) VALUES (?, ?, ?, ?)")
        .run(id, achievement.name, `${achievement.name} milestone`, index);
      if (achievement.unlocked) {
        this.db.prepare("INSERT INTO user_achievements (achievement_id, unlocked_at) VALUES (?, ?)")
          .run(id, nowIso());
      }
    });

    snapshot.dailyTasks.forEach((task, index) => {
      const id = task.id ?? `task-${index + 1}`;
      const rewardXp = Number((task.reward.match(/\+(\d+)\s*XP/i) || [0, 0])[1]);
      const rewardCredits = Number((task.reward.match(/\+(\d+)\s*credits?/i) || [0, 0])[1]);
      this.db.prepare(
        "INSERT INTO daily_tasks (id, name, reward, reward_xp, reward_credits, target_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, task.name, task.reward, rewardXp, rewardCredits, index === 0 ? 1 : 3, index);
      if (task.complete) {
        this.db.prepare("INSERT INTO task_completions (task_id, completed_at, date_key) VALUES (?, ?, ?)")
          .run(id, nowIso(), currentDateKey());
      }
    });

    snapshot.cosmetics.forEach((cosmetic, index) => {
      const id = cosmetic.id ?? `cosmetic-${index + 1}`;
      this.db.prepare("INSERT INTO cosmetics (id, name, cost, sort_order) VALUES (?, ?, ?, ?)")
        .run(id, cosmetic.name, cosmetic.cost, index);
      if (cosmetic.owned) {
        this.db.prepare("INSERT INTO user_cosmetics (cosmetic_id, owned_at, equipped) VALUES (?, ?, ?)")
          .run(id, nowIso(), index === 0 ? 1 : 0);
      }
    });

    this.db.prepare("INSERT INTO streak_state (id, current_streak, last_active_date, freeze_count) VALUES (1, ?, ?, ?)")
      .run(snapshot.progress.streak, currentDateKey(), 0);

    this.db.prepare("INSERT INTO site_settings (id, announcements, maintenance_mode) VALUES (1, ?, ?)")
      .run(snapshot.admin.announcements, snapshot.admin.maintenanceMode ? 1 : 0);

    snapshot.admin.auditLog.slice(0, 25).forEach((entry) => {
      this.db.prepare("INSERT INTO audit_log (entry, created_at) VALUES (?, ?)")
        .run(entry, nowIso());
    });

    snapshot.admin.users.forEach((user, index) => {
      const normalized = normalizeUser(user, index);
      this.db.prepare(
        "INSERT INTO users (id, username, email, level, status, credits, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        normalized.id,
        normalized.username,
        normalized.email,
        normalized.level,
        normalized.status,
        normalized.credits,
        normalized.streak,
        normalized.createdAt,
        normalized.updatedAt
      );
    });

    const reviewQueue = snapshot.admin.contentReviewQueue.length
      ? snapshot.admin.contentReviewQueue
      : [{
          id: "content-review-1",
          itemType: "lesson",
          itemId: snapshot.lessons[0]?.id ?? "anime-intro",
          status: "pending",
          notes: "Seeded review queue",
        }];
    reviewQueue.forEach((item) => {
      this.db.prepare("INSERT INTO content_review_queue (id, item_type, item_id, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(item.id, item.itemType, item.itemId, item.status, item.notes, nowIso());
    });
  }

  createSession(username) {
    const id = randomUUID();
    this.db.prepare("INSERT INTO admin_sessions (id, username, created_at) VALUES (?, ?, ?)").run(id, username, nowIso());
    return id;
  }

  revokeSession(sessionId) {
    this.db.prepare("DELETE FROM admin_sessions WHERE id = ?").run(sessionId);
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    return this.db.prepare("SELECT * FROM admin_sessions WHERE id = ?").get(sessionId);
  }

  verifyAdminCredentials(username, password) {
    const user = this.db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
    if (!user) return false;
    return user.password_hash === sha256(password);
  }

  getLessons() {
    return this.getSnapshot().lessons;
  }

  getReviews() {
    return this.getSnapshot().reviews;
  }

  getProgress() {
    return this.getSnapshot().progress;
  }

  getGamification() {
    const snapshot = this.getSnapshot();
    return {
      progress: snapshot.progress,
      achievements: snapshot.achievements,
      dailyTasks: snapshot.dailyTasks,
      cosmetics: snapshot.cosmetics,
      leaderboard: this.getLatestLeaderboard(),
    };
  }

  getSettings() {
    const row = this.db.prepare("SELECT * FROM site_settings WHERE id = 1").get();
    return {
      announcements: row?.announcements ?? INITIAL_APP_STATE.admin.announcements,
      maintenanceMode: Boolean(row?.maintenance_mode),
    };
  }

  getAiUsage() {
    return this.getSnapshot().admin.aiUsage;
  }

  getAuditLog() {
    return this.getSnapshot().admin.auditLog;
  }

  getContentReviewQueue() {
    return this.getSnapshot().admin.contentReviewQueue;
  }

  reviewContentItem(itemId, patch = {}) {
    const current = this.db.prepare("SELECT * FROM content_review_queue WHERE id = ?").get(itemId);
    if (!current) return null;
    const nextStatus = patch.status ?? current.status;
    const nextNotes = patch.notes ?? current.notes;
    this.db.prepare("UPDATE content_review_queue SET status = ?, notes = ? WHERE id = ?")
      .run(nextStatus, nextNotes, itemId);
    this.appendAudit(`Content review ${itemId}: ${nextStatus}`);
    return this.getContentReviewQueue();
  }

  getPermissionMatrix() {
    const roles = this.db.prepare("SELECT * FROM roles ORDER BY name").all();
    const permissions = this.db.prepare("SELECT * FROM permissions ORDER BY name").all();
    const assignments = this.db.prepare("SELECT role_id, permission_id FROM role_permissions").all();
    return {
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: assignments
          .filter((row) => row.role_id === role.id)
          .map((row) => permissions.find((permission) => permission.id === row.permission_id)?.name)
          .filter(Boolean),
      })),
      permissions: permissions.map((permission) => ({ id: permission.id, name: permission.name })),
    };
  }

  searchDictionary(query) {
    const term = String(query ?? "").trim();
    if (!term) {
      return this.db.prepare("SELECT * FROM dictionary_entries ORDER BY term LIMIT 20").all().map((row) => this.mapDictionaryRow(row));
    }
    return this.db.prepare(
      "SELECT * FROM dictionary_entries WHERE term LIKE ? OR reading LIKE ? OR meaning LIKE ? ORDER BY term LIMIT 20"
    ).all(`%${term}%`, `%${term}%`, `%${term}%`).map((row) => this.mapDictionaryRow(row));
  }

  mapDictionaryRow(row) {
    return {
      id: row.id,
      term: row.term,
      reading: row.reading,
      meaning: row.meaning,
      partOfSpeech: row.part_of_speech,
      example: row.example,
      source: row.source,
    };
  }

  getDictionary(query = "") {
    return this.searchDictionary(query);
  }

  lookupDictionary(term) {
    const query = String(term ?? "").trim();
    if (!query) return null;
    return this.searchDictionary(query)[0] ?? null;
  }

  aiResponse(feature, prompt, context = {}, sessionUser = null) {
    const response = answerAiFeature(feature, prompt, context);
    this.recordAiUsage(feature, 1, Math.max(40, String(prompt ?? "").length * 3), sessionUser ?? "local");
    return {
      feature,
      prompt,
      response,
      context,
    };
  }

  getUsers(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.username) {
      conditions.push("username LIKE ?");
      params.push(`%${filters.username}%`);
    }
    if (filters.email) {
      conditions.push("email LIKE ?");
      params.push(`%${filters.email}%`);
    }
    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.level) {
      conditions.push("level = ?");
      params.push(Number(filters.level));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(`SELECT * FROM users ${where} ORDER BY level DESC, username`).all(...params).map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      level: row.level,
      status: row.status,
      credits: row.credits,
      streak: row.streak,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  upsertUser(user) {
    const normalized = normalizeUser(user, 0);
    this.db.prepare(
      `
        INSERT INTO users (id, username, email, level, status, credits, streak, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          email = excluded.email,
          level = excluded.level,
          status = excluded.status,
          credits = excluded.credits,
          streak = excluded.streak,
          updated_at = excluded.updated_at
      `
    ).run(
      normalized.id,
      normalized.username,
      normalized.email,
      normalized.level,
      normalized.status,
      normalized.credits,
      normalized.streak,
      normalized.createdAt,
      normalized.updatedAt
    );
    this.appendAudit(`Upserted user: ${normalized.username}`);
    return normalized;
  }

  updateUser(userId, patch) {
    const current = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!current) return null;
    const next = {
      id: current.id,
      username: patch.username ?? current.username,
      email: patch.email ?? current.email,
      level: patch.level ?? current.level,
      status: patch.status ?? current.status,
      credits: patch.credits ?? current.credits,
      streak: patch.streak ?? current.streak,
      createdAt: current.created_at,
      updatedAt: nowIso(),
    };
    this.db.prepare(
      "UPDATE users SET username = ?, email = ?, level = ?, status = ?, credits = ?, streak = ?, updated_at = ? WHERE id = ?"
    ).run(next.username, next.email, next.level, next.status, next.credits, next.streak, next.updatedAt, userId);
    this.appendAudit(`Updated user: ${next.username}`);
    return next;
  }

  deleteUser(userId) {
    const current = this.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
    if (!current) return false;
    this.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    this.appendAudit(`Deleted user: ${current.username}`);
    return true;
  }

  resetDatabase() {
    this.db.exec("DROP TABLE IF EXISTS admin_sessions; DROP TABLE IF EXISTS admin_users; DROP TABLE IF EXISTS content_review_queue; DROP TABLE IF EXISTS ai_usage_log; DROP TABLE IF EXISTS audit_log; DROP TABLE IF EXISTS site_settings; DROP TABLE IF EXISTS role_permissions; DROP TABLE IF EXISTS permissions; DROP TABLE IF EXISTS roles; DROP TABLE IF EXISTS user_cosmetics; DROP TABLE IF EXISTS cosmetics; DROP TABLE IF EXISTS leaderboard_snapshots; DROP TABLE IF EXISTS streak_state; DROP TABLE IF EXISTS task_completions; DROP TABLE IF EXISTS daily_tasks; DROP TABLE IF EXISTS user_achievements; DROP TABLE IF EXISTS achievements; DROP TABLE IF EXISTS credits_ledger; DROP TABLE IF EXISTS xp_events; DROP TABLE IF EXISTS study_sessions; DROP TABLE IF EXISTS progress_snapshots; DROP TABLE IF EXISTS review_history; DROP TABLE IF EXISTS review_items; DROP TABLE IF EXISTS exercise_items; DROP TABLE IF EXISTS lesson_dialogue_lines; DROP TABLE IF EXISTS lesson_grammar; DROP TABLE IF EXISTS lesson_kanji; DROP TABLE IF EXISTS lesson_vocab; DROP TABLE IF EXISTS lessons; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS progress_state; DROP TABLE IF EXISTS app_state; DROP TABLE IF EXISTS schema_meta;");
    this.migrate();
    this.seedIfNeeded();
    return this.getSnapshot();
  }

  getLatestLeaderboard() {
    const row = this.db.prepare("SELECT payload_json FROM leaderboard_snapshots ORDER BY id DESC LIMIT 1").get();
    return row ? parseJson(row.payload_json, []) : [];
  }

  getSchemaVersion() {
    return getSchemaVersion(this.db);
  }

  loadLessonVocab(lessonId) {
    return this.db.prepare("SELECT word, kana, meaning FROM lesson_vocab WHERE lesson_id = ? ORDER BY order_index, id").all(lessonId);
  }

  loadLessonKanji(lessonId) {
    return this.db.prepare("SELECT kanji FROM lesson_kanji WHERE lesson_id = ? ORDER BY order_index, id").all(lessonId).map((row) => row.kanji);
  }

  replaceLessonChildren(lessonId, lesson) {
    this.db.prepare("DELETE FROM lesson_vocab WHERE lesson_id = ?").run(lessonId);
    this.db.prepare("DELETE FROM lesson_kanji WHERE lesson_id = ?").run(lessonId);
    this.db.prepare("DELETE FROM lesson_grammar WHERE lesson_id = ?").run(lessonId);
    this.db.prepare("DELETE FROM lesson_dialogue_lines WHERE lesson_id = ?").run(lessonId);
    this.db.prepare("DELETE FROM exercise_items WHERE lesson_id = ?").run(lessonId);
    lesson.vocab.forEach((item, index) => {
      this.db.prepare("INSERT INTO lesson_vocab (lesson_id, word, kana, meaning, order_index) VALUES (?, ?, ?, ?, ?)")
        .run(lessonId, item.word, item.kana, item.meaning, index);
    });
    lesson.kanji.forEach((item, index) => {
      this.db.prepare("INSERT INTO lesson_kanji (lesson_id, kanji, order_index) VALUES (?, ?, ?)")
        .run(lessonId, item, index);
    });
    this.db.prepare("INSERT INTO lesson_grammar (lesson_id, explanation, order_index) VALUES (?, ?, ?)").run(lessonId, lesson.grammar, 0);
    this.db.prepare("INSERT INTO lesson_dialogue_lines (lesson_id, speaker, text, order_index) VALUES (?, ?, ?, ?)").run(lessonId, "Narration", lesson.japanese, 0);
    this.db.prepare(
      "INSERT INTO exercise_items (id, lesson_id, type, prompt, choices_json, answer, explanation, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      `${lessonId}-exercise`,
      lessonId,
      "multiple-choice",
      `Which meaning best fits: ${lesson.japanese}`,
      toJson([lesson.translation, lesson.grammar, lesson.theme]),
      lesson.translation,
      lesson.grammar,
      0
    );
  }

  insertLessonRow(lesson, orderIndex = 0) {
    this.db.prepare(
      "INSERT INTO lessons (id, title, theme, difficulty, japanese, romaji, translation, grammar, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(lesson.id, lesson.title, lesson.theme, lesson.difficulty, lesson.japanese, lesson.romaji, lesson.translation, lesson.grammar, orderIndex);
    this.replaceLessonChildren(lesson.id, lesson);
  }
}

export function createStorageAdapter(filePath) {
  return new SqliteStorageAdapter(filePath);
}
