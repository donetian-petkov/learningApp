import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";

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
};

createServer(async (req, res) => {
  const url = req.url === "/" ? "/index.html" : req.url ?? "/index.html";
  const safePath = normalize(decodeURIComponent(url)).replace(/^(\.\.(\/|\\|$))+/, "");
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
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`Server error: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Pop Culture Japanese is running at http://127.0.0.1:${port}`);
});

