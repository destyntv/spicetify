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
