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
