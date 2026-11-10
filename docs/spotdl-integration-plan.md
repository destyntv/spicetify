# spotDL integration plan

Status: first implementation milestone, isolated worker + Studio proxy
Repository: `destyntv/spicetify`

## Decisions

- Keep the existing downloader and its queue intact. spotDL is an additional selectable engine, not a replacement.
- Keep the existing Spicetify CLI and its root-level build/runtime untouched.
- Deploy the spotDL worker as a separate Railway service from `spotdl-worker/`.
- Keep the Studio UI in `studio/`; it calls the worker through a same-origin Studio server proxy. The worker API key stays in Railway variables and is never sent to browser JavaScript. The public Studio proxy also requires a separate owner-configured access key before it accepts download submissions.
- Support two destinations as separate execution adapters:
  - **Railway:** isolated spotDL worker writes to its own Railway Volume mounted at `/music`.
  - **Windows PC:** local Windows agent runs spotDL under the signed-in user and writes to a user-selected local folder. Railway never writes to a Windows path.
- Do not run Spicetify CLI commands or patch Spotify in Railway.

## First milestone delivered in this branch

- A Python spotDL worker with authenticated enqueue/status endpoints.
- Strict Spotify URL validation for track, album, playlist, and artist resources.
- Fixed subprocess argument vector with `shell=False`; no arbitrary command or option input.
- One worker process at a time and a bounded pending queue.
- Studio download form and same-origin proxy routes.
- A separate worker Dockerfile and deployment instructions.
- CI for worker unit tests, Docker image build, and Studio smoke tests.

## Windows destination

The Windows destination is deliberately not implemented by the Railway worker. It belongs in `agent/windows/` and must follow the merged local-agent architecture in `docs/studio-desktop-architecture.md`: loopback-only binding, short-lived pairing, typed allowlisted operations, signed-in user context, no elevation, and no arbitrary shell execution. The current branch leaves the agent unpaired and labels the local destination as a later adapter milestone rather than pretending it is available.

## Railway rollout

1. Merge the Studio foundation PR before this stacked PR.
2. Create a new Railway service rooted at `/spotdl-worker`; do not edit the existing service.
3. Attach a Railway Volume to the new worker at `/music`. Do not use a Docker `VOLUME` instruction.
4. Set `SPOTDL_API_KEY` on the worker and Studio services to the same long random secret.
5. Set a separate `SPOTDL_STUDIO_ACCESS_KEY` on Studio; users enter this in the Studio download form. The browser stores it only in session storage.
6. Set `SPOTDL_WORKER_URL` on Studio to the worker HTTPS URL.
7. Verify worker `/health`, authenticated job submission, unauthorized-request rejection, status polling, and file creation on the new volume before enabling the feature for normal use.

## Rollback

- Remove `SPOTDL_WORKER_URL`, `SPOTDL_API_KEY`, and `SPOTDL_STUDIO_ACCESS_KEY` from the Studio service to disable spotDL submission.
- Leave the existing downloader and its data/volume untouched.
- The new worker service and its volume can be stopped independently. Do not delete its volume until downloaded files have been backed up or are no longer needed.

## Known limitations

- Worker job state is in memory and resets on restart; persistent queue/history is a later milestone.
- The worker serializes jobs to one active spotDL process.
- The Windows local destination and engine-selection preference are a separate agent milestone.
- Downloads depend on matching Spotify metadata to an available audio source. spotDL uses YouTube; it does not retrieve Spotify's audio stream. Users are responsible for ensuring they have permission to save the resulting audio.
