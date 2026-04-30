import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { createStorageAdapter } from "./db.mjs";

const store = createStorageAdapter();
const root = process.cwd();
const port = Number(process.env.PORT || 4173);
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

async function handleApi(req, res, url) {
  const session = getAdminSession(req);

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

  if (req.method === "POST" && url.pathname === "/api/lessons") {
    const body = await readJson(req);
    const current = store.getSnapshot(session);
    current.lessons.unshift(body);
    respondJson(res, 200, store.saveAppState(current, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/lessons/")) {
    const lessonId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
    const current = store.getSnapshot(session);
    current.lessons = current.lessons.map((lesson) =>
      lesson.id === lessonId ? { ...lesson, ...body, id: lessonId } : lesson
    );
    respondJson(res, 200, store.saveAppState(current, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/lessons/")) {
    const lessonId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const current = store.getSnapshot(session);
    current.lessons = current.lessons.filter((lesson) => lesson.id !== lessonId);
    current.progress.completedLessons = current.progress.completedLessons.filter((id) => id !== lessonId);
    current.reviews = current.reviews.filter((review) => review.id !== lessonId && review.sourceLessonId !== lessonId);
    respondJson(res, 200, store.saveAppState(current, session?.sessionUser ?? null));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/reviews") {
    respondJson(res, 200, store.getReviews());
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/reviews/")) {
    const reviewId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const body = await readJson(req);
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

  if (req.method === "GET" && url.pathname === "/api/gamification") {
    respondJson(res, 200, store.getGamification());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin") {
    respondJson(res, 200, store.loadAdminState(session?.sessionUser ?? null));
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
    const current = store.getSnapshot(session);
    current.admin.announcements = body.announcements ?? current.admin.announcements;
    current.admin.maintenanceMode = Boolean(body.maintenanceMode ?? current.admin.maintenanceMode);
    current.admin.siteHealth = current.admin.maintenanceMode ? "Amber" : "Green";
    respondJson(res, 200, store.saveAppState(current, session?.sessionUser ?? null));
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

  respondJson(res, 404, { error: "Not found" });
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

function respondJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function getCookie(req, name) {
  const header = req.headers.cookie ?? "";
  const pairs = header.split(";").map((part) => part.trim().split("="));
  const found = pairs.find(([key]) => key === name);
  return found ? decodeURIComponent(found.slice(1).join("=")) : null;
}

function getAdminSession(req) {
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
