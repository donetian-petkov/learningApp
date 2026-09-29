import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import test from "node:test";

process.env.LEARNINGAPP_DISABLE_SERVER = "1";
const { createApiHandler, serveStatic } = await import("../server.mjs");

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
      this.body = body ?? null;
    },
  };
}

async function get(pathname, headers = {}) {
  const res = createMockResponse();
  await serveStatic({ method: "GET", headers }, res, pathname);
  return res;
}

test("static server serves the app files", async () => {
  const index = await get("/");
  assert.equal(index.statusCode, 200);
  assert.match(index.headers["content-type"], /text\/html/);
  assert.match(String(index.body), /<script type="module" src="\.\/app\.js">/);

  const font = await get("/fonts/inter-latin-wght-normal.woff2");
  assert.equal(font.statusCode, 200);
  assert.equal(font.headers["content-type"], "font/woff2");

  const script = await get("/app.js");
  assert.equal(script.statusCode, 200);
  assert.match(script.headers["content-type"], /javascript/);
});

test("static server never hands out the database, backups, server code or git data", async () => {
  for (const path of [
    "/data/learning-app.sqlite",
    "/backups/demo-content.backup.json",
    "/db.mjs",
    "/server.mjs",
    "/package.json",
    "/.git/config",
    "/../etc/passwd",
    "/%2e%2e/%2e%2e/etc/passwd",
    "/docs/screenshots/../../db.mjs",
  ]) {
    const res = await get(path);
    // Either a 404, or (for extension-less paths) the normal app shell - never the file itself.
    if (res.statusCode === 200) assert.match(res.headers["content-type"], /text\/html/, `${path} leaked`);
    assert.doesNotMatch(String(res.body ?? ""), /createStorageAdapter|SQLite format|root:/);
  }
});

test("unknown page routes fall back to the app shell", async () => {
  const res = await get("/review");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/html/);
});

test("static server supports ETag revalidation and gzip", async () => {
  const first = await get("/app.js", { "accept-encoding": "gzip, br" });
  assert.equal(first.headers["content-encoding"], "gzip");
  assert.ok(first.headers.etag);
  assert.match(gunzipSync(first.body).toString("utf8"), /function render\(/);

  const again = await get("/app.js", { "if-none-match": first.headers.etag });
  assert.equal(again.statusCode, 304);
  assert.equal(again.body, null);
});

test("background state saves get an empty reply instead of the whole state", async () => {
  const calls = [];
  const handler = createApiHandler({
    getSession: () => null,
    saveAppState(body, user, options) {
      calls.push(options);
      return options?.returnSnapshot === false ? null : { view: "learn" };
    },
  });
  const post = async (headers) => {
    const res = createMockResponse();
    const req = {
      method: "POST",
      headers,
      url: "/api/state",
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ view: "learn" }));
      },
    };
    await handler(req, res, new URL("http://127.0.0.1/api/state"));
    return res;
  };

  const minimal = await post({ prefer: "return=minimal" });
  assert.equal(minimal.statusCode, 204);
  assert.equal(minimal.body, null);
  assert.deepEqual(calls[0], { returnSnapshot: false });

  const full = await post({});
  assert.equal(full.statusCode, 200);
  assert.deepEqual(JSON.parse(full.body), { view: "learn" });
});

test("changing the admin password requires a signed-in admin", async () => {
  const handler = createApiHandler({
    getSession: () => null,
    changeAdminPassword: () => assert.fail("should not be called without a session"),
  });
  const res = createMockResponse();
  const req = {
    method: "POST",
    headers: {},
    url: "/api/admin/password",
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify({ currentPassword: "x", newPassword: "y" }));
    },
  };
  await handler(req, res, new URL("http://127.0.0.1/api/admin/password"));
  assert.equal(res.statusCode, 401);
});
