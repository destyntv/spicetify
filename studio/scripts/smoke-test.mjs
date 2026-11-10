import assert from "node:assert/strict";
import { createServer } from "../server.mjs";

const server = createServer();
server.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));

try {
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", service: "spicetify-studio" });

  const status = await fetch(`${base}/api/status`);
  assert.equal(status.status, 200);
  const payload = await status.json();
  assert.equal(payload.agent.state, "not-paired");
  assert.equal(payload.players.desktop.state, "awaiting-local-agent");
  assert.equal(payload.players.web.state, "not-connected");
  assert.equal(payload.capabilities.remoteDesktopPatching, false);
  assert.equal(payload.capabilities.arbitraryCommandExecution, false);\n  assert.equal(payload.downloads.existing.state, "preserved");\n  assert.equal(payload.downloads.spotdl.state, "not-configured");

  const page = await fetch(base);
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /Spicetify Studio/);
  assert.match(pageHtml, /id="connect-spotify"/);
  assert.match(pageHtml, /id="pair-agent"/);
  assert.match(pageHtml, /id="refresh-status"/);\n  assert.match(pageHtml, /id="spotdl-form"/);

  const clientScript = await fetch(`${base}/app.js`);
  assert.equal(clientScript.status, 200);
  const clientCode = await clientScript.text();
  assert.match(clientCode, /code_challenge_method: "S256"/);
  assert.match(clientCode, /Spotify sign-in could not be verified/);

  const downloads = await fetch(`${base}/api/downloads`, {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ url: "https://open.spotify.com/track/0123456789012345678901" })\n  });\n  assert.equal(downloads.status, 503);\n\n  const missing = await fetch(`${base}/not-found`);
  assert.equal(missing.status, 404);

  console.log("Studio smoke tests passed.");
} finally {
  server.close();
}
