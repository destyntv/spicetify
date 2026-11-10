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

The Windows agent is not implemented in this milestone, so the desktop card explains that pairing is not yet available rather than presenting a dead control. Spotify Web Player supports browser-based sign-in with Spotify's Authorization Code + PKCE flow. The browser stores the Client ID in local storage and session tokens in session storage; no client secret is used or sent to the service. This establishes account sign-in only—the playback-control interface is a later milestone.

### Configure Spotify sign-in

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add the exact redirect URI shown in the Studio connection card (your Studio origin followed by `/`).
3. Copy the app's Client ID into the Studio connection card and choose **Save Client ID**.
4. Choose **Connect Spotify** and approve the requested basic profile/email scopes.

The connection can be removed with **Disconnect**. Access and refresh tokens are kept in the current browser session, not on the Railway service.

## Railway

Create a separate Railway service from this repository and set its **Root Directory** to `/studio`. Use:

- Build command: `npm install` (no third-party runtime dependencies).
- Start command: `npm start`.
- Health check path: `/health`.

Railway hosts only this web service. Do not deploy the Windows agent or run Spicetify CLI in the Railway container. Do not add a volume for a local Spotify installation.

## Optional spotDL engine

spotDL is an additional engine; it does not replace the existing downloader. The Studio browser submits jobs to same-origin `/api/downloads` routes. The Studio server forwards them to a separate worker so the worker API key never reaches browser JavaScript.

Configure these variables on the **Studio Railway service** after deploying the worker:

- `SPOTDL_WORKER_URL`: HTTPS base URL of the separate spotDL worker.
- `SPOTDL_API_KEY`: the same long random secret configured on the worker.

Deploy the worker separately from `spotdl-worker/`; see [spotdl-worker/README.md](../spotdl-worker/README.md). Attach a Railway Volume to that worker at `/music`. Do not change the existing Studio service's root directory, start command, or volume.

The Studio UI reports spotDL as not configured until both variables are present. When configured, users can submit Spotify track, album, playlist, and artist URLs and view worker job status. The worker's in-memory queue resets on restart; persistent job history and cancellation are later milestones.

The Windows download destination remains a local-agent responsibility. Railway cannot write to the user's PC. The Windows agent must run spotDL locally under the signed-in Windows user and use a user-selected local folder; it must not expose a public download endpoint or arbitrary shell execution.

- `SPOTDL_STUDIO_ACCESS_KEY`: a separate long random passphrase required by the Studio download form. The browser keeps it in session storage only; it is not the worker API key.

The Studio proxy requires this access key before it forwards any download request. This protects the public Studio endpoint from anonymous queue submissions. Keep `SPOTDL_API_KEY` private to the Studio server and worker; never enter it into the browser form.
