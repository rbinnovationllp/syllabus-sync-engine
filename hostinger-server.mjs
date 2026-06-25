import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";

function loadEnvFile(file = ".env") {
  if (!existsSync(file)) return;

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const app = (await import("./dist/server/server.js")).default;
const port = Number(process.env.PORT || 3000);
const publicDir = resolve("dist/client");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const filePath = normalize(join(publicDir, decodedPath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  const type = contentTypes[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": decodedPath.includes("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300",
  });
  createReadStream(filePath).pipe(res);
  return true;
}

function toWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url || "/"}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value != null) {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req),
    duplex: req.method === "GET" || req.method === "HEAD" ? undefined : "half",
  });
}

async function sendWebResponse(webResponse, res) {
  res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
  if (!webResponse.body) {
    res.end();
    return;
  }
  Readable.fromWeb(webResponse.body).pipe(res);
}

createServer(async (req, res) => {
  try {
    if (sendStatic(req, res)) return;

    const webRequest = toWebRequest(req);
    const webResponse = await app.fetch(webRequest, process.env, {});
    await sendWebResponse(webResponse, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
}).listen(port, () => {
  console.log(`Syllabus Sync listening on http://localhost:${port}`);
});
