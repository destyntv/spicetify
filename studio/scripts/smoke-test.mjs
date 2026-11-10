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
  assert.equal(payload.capabilities.arbitraryCommandExecution, false);

  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Spicetify Studio/);

  const missing = await fetch(`${base}/not-found`);
  assert.equal(missing.status, 404);

  console.log("Studio smoke tests passed.");
} finally {
  server.close();
}
