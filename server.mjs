import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, normalize } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createStorageAdapter } from "./db.mjs";

const store = process.env.LEARNINGAPP_DISABLE_SERVER === "1" ? null : createStorageAdapter();
const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const execFileAsync = promisify(execFile);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mjs": "text/javascript; charset=utf-8",
};

const handleApi = store ? createApiHandler(store) : null;

if (store) {
  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      try {
        await handleApi(req, res, url);
      } catch (error) {
        respondJson(res, 500, {
          error: error instanceof Error ? error.message : "Unknown server error",
        });
      }
      return;
    }

    await serveStatic(req, res, url.pathname);
  }).listen(port, "127.0.0.1", () => {
    console.log(`Pop Culture Japanese is running at http://127.0.0.1:${port}`);
  });
}

export function createApiHandler(store) {
  return async function handleApi(req, res, url) {
    const session = getAdminSession(req, store);

  if (req.method === "GET" && url.pathname === "/api/state") {
    respondJson(res, 200, store.getSnapshot(session));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/state") {
    const body = await readJson(req);
    const next = store.saveAppState(body, session?.sessionUser ?? null);
    respondJson(res, 200, next);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/lessons") {
    respondJson(res, 200, store.getLessons());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/dictionary") {
    respondJson(res, 200, store.getDictionary(url.searchParams.get("query") ?? ""));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/kanji") {
    respondJson(res, 200, store.getKanjiEntries(url.searchParams.get("query") ?? ""));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/kanji/reviews") {
    respondJson(res, 200, store.getKanjiReviews());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/dictionary/import") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    const imported = store.importDictionaryEntries(body.entries ?? body.entry ?? body);
    respondJson(res, 200, { imported: imported.length, entries: imported });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/datasets/import") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    const result = store.importDatasetBundle(body.bundle ?? body.dataset ?? body);
    respondJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/kanji/import") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    const imported = store.importKanjiEntries(body.entries ?? body.entry ?? body);
    respondJson(res, 200, { imported: imported.length, entries: imported });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/kanji/reviews/")) {
    const reviewId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
    respondJson(res, 200, store.gradeKanjiReview(reviewId, body.grade ?? 4));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lessons") {
    const body = await readJson(req);
    respondJson(res, 200, store.createLesson(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lessons/import") {
    const body = await readJson(req);
    const imported = store.importLessons(body.lessons ?? body.lesson ?? body);
    respondJson(res, 200, { imported: imported.length, lessons: imported });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/lessons/")) {
    const lessonId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
    const updated = store.updateLesson(lessonId, body);
    respondJson(res, updated ? 200 : 404, updated ?? { error: "Not found" });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/lessons/")) {
    const lessonId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const deleted = store.deleteLesson(lessonId);
    respondJson(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Not found" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/reviews") {
    respondJson(res, 200, store.getReviews());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reviews/import") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    const imported = store.importReviewItems(body.reviews ?? body.review ?? body);
    respondJson(res, 200, { imported: imported.length, reviews: imported });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/reviews/")) {
    const reviewId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
    if (body.grade != null) {
      respondJson(res, 200, store.gradeReview(reviewId, body.grade));
      return;
    }
    const current = store.getSnapshot(session);
    current.reviews = current.reviews.map((review) =>
      review.id === reviewId ? { ...review, ...body, id: reviewId } : review
    );
    respondJson(res, 200, store.saveAppState(current, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/progress") {
    respondJson(res, 200, store.getProgress());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/progress/lesson-complete") {
    const body = await readJson(req);
    respondJson(res, 200, store.completeLesson(body.lessonId ?? "", session?.sessionUser ?? null));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/progress/task-complete") {
    const body = await readJson(req);
    const result = store.completeTask(body.taskId ?? "", session?.sessionUser ?? null);
    respondJson(res, result ? 200 : 404, result ?? { error: "Not found" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/progress/bookmarks") {
    const body = await readJson(req);
    const result = store.toggleStudyBookmark(body.kind ?? "word", body.item ?? body, session?.sessionUser ?? null);
    respondJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/progress/lesson-note") {
    const body = await readJson(req);
    const result = store.saveLessonNote(body.lessonId ?? "", body.note ?? "", session?.sessionUser ?? null);
    respondJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/cosmetics/buy") {
    const body = await readJson(req);
    try {
      respondJson(res, 200, store.buyCosmetic(body.cosmeticId ?? "", session?.sessionUser ?? null));
    } catch (error) {
      respondJson(res, 400, { error: error instanceof Error ? error.message : "Unable to purchase cosmetic" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/cosmetics/equip") {
    const body = await readJson(req);
    const result = store.equipCosmetic(body.cosmeticId ?? "", session?.sessionUser ?? null);
    if (!result) {
      respondJson(res, 404, { error: "Cosmetic not owned" });
    } else {
      respondJson(res, 200, result);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/practice") {
    const body = await readJson(req);
    try {
      respondJson(res, 200, store.recordPracticeSession(body.kind ?? "", body, session?.sessionUser ?? null));
    } catch (error) {
      respondJson(res, 400, { error: error instanceof Error ? error.message : "Unsupported practice submission" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ai/response") {
    const body = await readJson(req);
    respondJson(res, 200, await store.aiResponse(body.feature ?? "tutor", body.prompt ?? "", body.context ?? {}, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/speech/status") {
    respondJson(res, 200, getSpeechStatus());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tts/status") {
    respondJson(res, 200, getTtsStatus());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/speech/transcribe") {
    const contentType = String(req.headers["content-type"] ?? "");
    if (contentType.includes("application/json")) {
      const body = await readJson(req);
      respondJson(res, 200, {
        transcript: normalizeTranscript(body.transcript ?? body.text ?? body.input ?? ""),
        source: "typed",
        provider: "none",
      });
      return;
    }

    const audio = await readBuffer(req);
    if (!audio.length) {
      respondJson(res, 400, { error: "No audio provided" });
      return;
    }

    try {
      const transcript = await transcribeWithWhisper(audio, contentType);
      respondJson(res, 200, transcript);
    } catch (error) {
      respondJson(res, 503, {
        error: error instanceof Error ? error.message : "Local transcription unavailable",
        provider: "whisper",
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tts/synthesize") {
    const body = await readJson(req);
    try {
      const audio = await synthesizeWithLocalTts(body.text ?? "", {
        language: body.language ?? "ja",
        voice: body.voice ?? "",
        rate: Number(body.rate ?? 1),
      });
      respondAudio(res, 200, audio.buffer, audio.mimeType);
    } catch (error) {
      respondJson(res, 503, {
        error: error instanceof Error ? error.message : "Local TTS unavailable",
        provider: "system-tts",
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/gamification") {
    respondJson(res, 200, store.getGamification());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/challenges") {
    respondJson(res, 200, store.getChallenges());
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/challenges/") && url.pathname.endsWith("/claim")) {
    const challengeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    respondJson(res, 200, store.claimChallenge(challengeId, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/study-sessions") {
    const limit = Number(url.searchParams.get("limit") ?? 20);
    respondJson(res, 200, store.getStudySessions(limit));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/study-sessions") {
    const body = await readJson(req);
    respondJson(res, 200, store.recordStudySession(body.kind ?? "manual", Number(body.durationMinutes ?? 0), Number(body.xpDelta ?? 0), Number(body.creditsDelta ?? 0), session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin") {
    respondJson(res, 200, store.loadAdminState(session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/export") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    respondJson(res, 200, store.getSnapshot(session));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/content-review") {
    respondJson(res, 200, store.getContentReviewQueue());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/content-review") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    respondJson(res, 200, store.enqueueContentReview({
      itemType: body.itemType ?? "lesson",
      itemId: body.itemId ?? "unknown",
      notes: body.notes ?? "Queued for review",
      source: body.source ?? "manual",
      status: body.status ?? "pending",
      decisionReason: body.decisionReason ?? "",
    }));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/content-review/")) {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const itemId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
    const updated = store.reviewContentItem(itemId, body, session?.sessionUser ?? null);
    respondJson(res, updated ? 200 : 404, updated ?? { error: "Not found" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/permissions") {
    respondJson(res, 200, store.getPermissionMatrix());
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/admin/permissions") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    respondJson(res, 200, store.savePermissionMatrix(body));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const filters = Object.fromEntries(url.searchParams.entries());
    respondJson(res, 200, store.getUsers(filters));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    respondJson(res, 200, store.upsertUser(body));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/users/")) {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const userId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
    const updated = store.updateUser(userId, body);
    respondJson(res, updated ? 200 : 404, updated ?? { error: "Not found" });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/users/")) {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const userId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const deleted = store.deleteUser(userId);
    respondJson(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Not found" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/reset") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    respondJson(res, 200, store.resetDatabase());
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/admin") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    const current = store.getSnapshot(session);
    current.admin = {
      ...current.admin,
      ...body,
      authenticated: true,
      sessionUser: session.sessionUser,
    };
    respondJson(res, 200, store.saveAppState(current, session.sessionUser));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/import") {
    if (!session.authenticated) {
      respondJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const body = await readJson(req);
    const snapshot = body.state ?? body.snapshot ?? body;
    respondJson(res, 200, store.saveAppState(snapshot, session.sessionUser));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/gamification/chest") {
    respondJson(res, 200, store.claimRewardChest());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/gamification/streak-freeze") {
    respondJson(res, 200, store.buyStreakFreeze(session?.sessionUser ?? null));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/gamification/award") {
    const body = await readJson(req);
    respondJson(res, 200, store.awardProgress(body.delta ?? {}, body.source ?? "manual"));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readJson(req);
    if (!store.verifyAdminCredentials(body.username ?? "", body.password ?? "")) {
      respondJson(res, 401, { error: "Invalid credentials" });
      return;
    }
    const sessionId = store.createSession(body.username);
    setCookie(res, "admin_session", sessionId);
    respondJson(res, 200, store.getSnapshot({ authenticated: true, sessionUser: body.username }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    const sessionId = getCookie(req, "admin_session");
    if (sessionId) {
      store.revokeSession(sessionId);
    }
    clearCookie(res, "admin_session");
    respondJson(res, 200, store.getSnapshot({ authenticated: false, sessionUser: null }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    respondJson(res, 200, store.getSettings());
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/settings") {
    const body = await readJson(req);
    respondJson(res, 200, store.updateSettings(body, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ai-usage") {
    respondJson(res, 200, store.getAiUsage());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/audit-log") {
    respondJson(res, 200, store.getAuditLog());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    respondJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/audit-log") {
    const body = await readJson(req);
    respondJson(res, 200, store.appendAudit(body.entry ?? "audit event"));
    return;
  }

  respondJson(res, 404, { error: "Not found" });
  };
}

async function serveStatic(req, res, pathname) {
  const urlPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(root, safePath);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(root, "index.html"));
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(data);
    } catch (error) {
      respondJson(res, 500, {
        error: error instanceof Error ? error.message : "Unable to load app",
      });
    }
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function normalizeTranscript(text) {
  return String(text ?? "")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/[ 　]+/g, " ")
    .trim();
}

function getSpeechStatus() {
  const whisperBinary = process.env.WHISPER_BIN ?? "whisper";
  const whisperModel = process.env.WHISPER_MODEL ?? "tiny";
  const modelDir = process.env.WHISPER_MODEL_DIR ?? "";
  const binaryConfigured = whisperBinary === "whisper" ? true : existsSync(whisperBinary);
  return {
    provider: "whisper",
    binary: whisperBinary,
    model: whisperModel,
    language: process.env.WHISPER_LANGUAGE ?? "ja",
    available: true,
    binaryConfigured,
    modelConfigured: Boolean(whisperModel || modelDir),
    modelDir: modelDir || null,
  };
}

function getTtsStatus() {
  const provider = String(process.env.TTS_PROVIDER ?? (process.platform === "darwin" ? "say" : "espeak")).toLowerCase();
  const binary = String(process.env.TTS_BIN ?? (provider === "say" ? "say" : provider === "espeak" ? "espeak" : provider));
  return {
    provider,
    binary,
    available: provider === "say" || provider === "espeak" || Boolean(process.env.TTS_BIN),
    language: process.env.TTS_LANGUAGE ?? "ja",
  };
}

async function synthesizeWithLocalTts(text, options = {}) {
  const content = String(text ?? "").trim();
  if (!content) {
    throw new Error("No text provided");
  }
  const provider = getTtsStatus();
  const tempDir = await mkdtemp(join(tmpdir(), "learningapp-tts-"));
  try {
    if (provider.provider === "say") {
      const audioPath = join(tempDir, "output.aiff");
      const args = ["-o", audioPath];
      if (options.voice) args.push("-v", String(options.voice));
      if (options.rate && Number.isFinite(options.rate)) args.push("-r", String(Math.max(80, Math.min(500, Math.round(options.rate * 200)))));
      args.push(content);
      await execFileAsync(provider.binary, args, { maxBuffer: 10 * 1024 * 1024 });
      const buffer = await readFile(audioPath);
      return { buffer, mimeType: "audio/aiff" };
    }

    if (provider.provider === "espeak") {
      const audioPath = join(tempDir, "output.wav");
      const args = ["-w", audioPath];
      if (options.language) args.push("-v", String(options.language));
      if (options.rate && Number.isFinite(options.rate)) args.push("-s", String(Math.max(80, Math.min(450, Math.round(options.rate * 175)))));
      args.push(content);
      await execFileAsync(provider.binary, args, { maxBuffer: 10 * 1024 * 1024 });
      const buffer = await readFile(audioPath);
      return { buffer, mimeType: "audio/wav" };
    }

    throw new Error("No local TTS provider configured");
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function transcribeWithWhisper(audioBuffer, contentType = "") {
  const whisperBinary = process.env.WHISPER_BIN ?? "whisper";
  const whisperModel = process.env.WHISPER_MODEL ?? "tiny";
  const modelDir = process.env.WHISPER_MODEL_DIR ?? "";
  const language = process.env.WHISPER_LANGUAGE ?? "ja";
  const tempDir = await mkdtemp(join(tmpdir(), "learningapp-whisper-"));
  const extension = contentType.includes("wav")
    ? "wav"
    : contentType.includes("mpeg")
      ? "mp3"
      : contentType.includes("mp4")
        ? "mp4"
        : "webm";
  const audioPath = join(tempDir, `input.${extension}`);
  try {
    await writeFile(audioPath, audioBuffer);
    const args = [
      audioPath,
      "--task",
      "transcribe",
      "--language",
      language,
      "--output_dir",
      tempDir,
      "--output_format",
      "txt",
      "--verbose",
      "False",
      "--model",
      whisperModel,
    ];
    if (modelDir) {
      args.splice(1, 0, "--model_dir", modelDir);
    }
    await execFileAsync(whisperBinary, args, { maxBuffer: 10 * 1024 * 1024 });
    const transcriptPath = join(tempDir, "input.txt");
    const transcript = normalizeTranscript(await readFile(transcriptPath, "utf8").catch(() => ""));
    return {
      transcript,
      source: "whisper",
      provider: "whisper",
      model: whisperModel,
      language,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function respondJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function respondAudio(res, statusCode, buffer, mimeType) {
  res.writeHead(statusCode, {
    "content-type": mimeType,
    "cache-control": "no-store",
  });
  res.end(buffer);
}

function getCookie(req, name) {
  const header = req.headers.cookie ?? "";
  const pairs = header.split(";").map((part) => part.trim().split("="));
  const found = pairs.find(([key]) => key === name);
  return found ? decodeURIComponent(found.slice(1).join("=")) : null;
}

function getAdminSession(req, store) {
  const sessionId = getCookie(req, "admin_session");
  const session = store.getSession(sessionId);
  if (!session) return { authenticated: false, sessionUser: null };
  return { authenticated: true, sessionUser: session.username };
}

function setCookie(res, name, value) {
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax`);
}

function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}
