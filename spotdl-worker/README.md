# Spicetify Studio spotDL worker

This is an isolated download service. It is intentionally separate from the existing Spicetify CLI and the existing Railway application so it can be deployed, tested, and rolled back independently.

## Runtime

- Python 3.12
- spotDL v4
- FFmpeg
- Deno (recommended by spotDL for some YouTube downloads)
- Railway Volume mounted at `/music`

## Railway deployment

Create a **new Railway service** from this repository:

- Root Directory: `/spotdl-worker`
- Builder: Dockerfile
- Volume mount path: `/music`
- Variables:
  - `SPOTDL_API_KEY`: long random secret; required for job endpoints
  - `SPOTDL_OUTPUT_DIR`: `/music` (default)
  - `SPOTDL_MAX_PENDING_JOBS`: `100` (default)
- Health check path: `/health`

Do not add a `VOLUME` instruction to the Dockerfile. Attach the Railway Volume in the service settings. Do not modify the existing Railway service, its start command, or its volume.

## API

All job endpoints require `Authorization: Bearer <SPOTDL_API_KEY>`.

- `GET /health` — unauthenticated health check.
- `POST /api/jobs` — enqueue a Spotify track, album, playlist, or artist URL. Returns HTTP 202 with a job ID.
- `GET /api/jobs/{id}` — retrieve job state and a bounded diagnostic log.

The worker accepts only HTTPS links on `open.spotify.com` and only the track, album, playlist, and artist resource types. It passes a fixed argument vector to spotDL; it never invokes a shell or accepts arbitrary command-line options.

## Operational limitations in this milestone

- Queue state is in memory and is lost if the worker restarts. Persistent job history and cancellation are later milestones.
- One spotDL process runs at a time to protect CPU, memory, and storage.
- The service is not exposed to the Studio browser directly. Studio should proxy requests server-to-server so the API key stays in Railway variables and never reaches browser JavaScript.
- Windows downloads remain on the Windows PC through the local agent; the Railway worker must never access or patch the local Spotify installation.

Only download content you are authorized to access and save. spotDL matches Spotify metadata to audio sourced from YouTube; it does not download Spotify's audio stream.
