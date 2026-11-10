# Spicetify Studio

Standalone web workspace for Spicetify Desktop + Studio. This first milestone is a read-only dashboard foundation; it does not install themes, patch Spotify, or execute local commands.

## Local development

Requirements: Node.js 20 or newer.

```sh
cd studio
npm run check
npm test
npm start
```

Open `http://localhost:3000`. The service exposes:

- `GET /health` — Railway health check.
- `GET /api/status` — read-only service, agent, and player integration status.

The Windows agent is not implemented in this milestone, so its state is intentionally reported as `not-paired`. Spotify Desktop and Spotify Web Player are separate integration targets.

## Railway

Create a separate Railway service from this repository and set its **Root Directory** to `/studio`. Use:

- Build command: `npm install` (no third-party runtime dependencies).
- Start command: `npm start`.
- Health check path: `/health`.

Railway hosts only this web service. Do not deploy the Windows agent or run Spicetify CLI in the Railway container. Do not add a volume for a local Spotify installation.

## spotDL downloads

spotDL is an optional, separate download engine. The existing downloader remains untouched. Studio proxies browser requests to the worker server-to-server so the worker API key is never exposed to browser JavaScript.

Configure these variables on the **Studio Railway service** after deploying the worker:

- `SPOTDL_WORKER_URL`: HTTPS base URL of the separate spotDL worker.
- `SPOTDL_API_KEY`: the same random secret configured on the worker.

Deploy the worker separately from `spotdl-worker/`; see [spotdl-worker/README.md](../spotdl-worker/README.md). Attach a Railway Volume to that worker at `/music`. Do not change the existing Studio service's root directory, start command, or volume.

The Studio UI reports spotDL as not configured until both variables are present. When configured, users can submit Spotify track, album, playlist, and artist URLs and view the worker job state. The worker's in-memory queue is an initial milestone; job persistence and cancellation are planned separately.

The Windows download destination remains a local-agent responsibility. Railway cannot write to the user's PC. The Windows agent must run spotDL locally under the signed-in Windows user and use a separate typed, allowlisted local-agent contract; it must not expose a public download endpoint or arbitrary shell execution.
