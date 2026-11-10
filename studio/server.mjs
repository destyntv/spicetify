import { createReadStream, existsSync, statSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(root, "public");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const status = {
  service: "spicetify-studio",
  status: "online",
  agent: { state: "not-paired", platform: "windows" },
  players: {
    desktop: { state: "awaiting-local-agent", integration: "windows-agent" },
    web: { state: "not-connected", integration: "supported-web-apis-only" }
  },
  downloads: { existing: { state: "preserved" } },
  capabilities: {
    remoteDesktopPatching: false,
    arbitraryCommandExecution: false
  }
};


function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request, maxBytes = 4096) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) throw new Error("Request body too large");
  }
  return JSON.parse(body || "{}");
}

function hasDownloadAccess(request) {
  const expected = process.env.SPOTDL_STUDIO_ACCESS_KEY || "";
  const supplied = request.headers["x-studio-download-key"] || "";
  if (!expected || typeof supplied !== "string") return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function workerConfig() {
  const baseUrl = process.env.SPOTDL_WORKER_URL;
  const apiKey = process.env.SPOTDL_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("SPOTDL_WORKER_URL must use HTTPS outside localhost");
  }
  return { baseUrl: parsed.toString().replace(/\/$/, ""), apiKey };
}

async function proxySpotdl(request, response, pathname) {
  let config;
  try {
    config = workerConfig();
  } catch (error) {
    sendJson(response, 503, { error: error.message });
    return;
  }
  if (!config || !process.env.SPOTDL_STUDIO_ACCESS_KEY) {
    sendJson(response, 503, { error: "spotDL worker or Studio download access is not configured" });
    return;
  }

  if (!hasDownloadAccess(request)) {
    sendJson(response, 401, { error: "Enter the Studio download access key to use spotDL" });
    return;
  }

  const jobMatch = pathname.match(/^\/api\/downloads\/([0-9a-f-]{36})$/i);
  const isCreate = pathname === "/api/downloads" && request.method === "POST";
  if (!isCreate && !(jobMatch && request.method === "GET")) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    let target;
    const options = {
      headers: { Authorization: "Bearer " + config.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    };
    if (isCreate) {
      const body = await readJsonBody(request);
      if (typeof body.url !== "string" || body.url.length > 2048) {
        sendJson(response, 400, { error: "Provide a Spotify URL" });
        return;
      }
      target = config.baseUrl + "/api/jobs";
      options.method = "POST";
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify({ url: body.url });
    } else {
      target = config.baseUrl + "/api/jobs/" + jobMatch[1];
    }

    const upstream = await fetch(target, options);
    const payload = await upstream.json().catch(() => ({ error: "Invalid response from spotDL worker" }));
    sendJson(response, upstream.status, payload);
  } catch (error) {
    sendJson(response, 502, { error: "spotDL worker request failed: " + error.message });
  }
}

export function createServer() {
  return createHttpServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    if (pathname === "/api/downloads" || pathname.startsWith("/api/downloads/")) {
      await proxySpotdl(request, response, pathname);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD, POST" });
      response.end("Method not allowed");
      return;
    }

    if (pathname === "/health" || pathname === "/api/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ status: "ok", service: status.service }));
      return;
    }

    if (pathname === "/api/status") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(JSON.stringify({
        ...status,
        downloads: {
          ...status.downloads,
          spotdl: { state: process.env.SPOTDL_WORKER_URL && process.env.SPOTDL_API_KEY && process.env.SPOTDL_STUDIO_ACCESS_KEY ? "configured" : "not-configured" }
        }
      }));
      return;
    }

    const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
    const filePath = resolve(publicRoot, "." + requestedPath);
    if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self' https://accounts.spotify.com https://api.spotify.com; img-src 'self' data:"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  createServer().listen(port, host, () => {
    console.log(`Spicetify Studio listening on ${host}:${port}`);
  });
}
