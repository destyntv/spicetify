# Spicetify Desktop + Studio Architecture

Status: implementation architecture baseline
Repository: `destyntv/spicetify`
Default branch: `main`
Architecture decision: keep the upstream-compatible Spicetify CLI isolated from the new product surfaces.

## Confirmed product decisions

- **Web application:** build both a browser-based Studio and a companion web experience.
- **Desktop agent:** Windows first.
- **Player surfaces:** support Spotify Desktop and the web player as distinct targets.
- **Scope:** keep the existing Spicetify CLI independent; add Studio and the Windows agent as separate components in this repository. Do not rewrite or couple the CLI to the new product.

## Component boundaries

| Component | Location | Runtime | Responsibility |
| --- | --- | --- | --- |
| Existing Spicetify CLI | repository root | Windows/macOS/Linux | Existing Spotify client customization; preserve behavior and upstream compatibility |
| Studio web app | `studio/` | Railway | Browser UI, account/session UX, theme and extension catalog, remote-safe orchestration |
| Windows local agent | `agent/windows/` | User's Windows session | Local discovery and explicitly authorized operations against the installed CLI / Spotify Desktop |
| Shared contracts | `contracts/` | TypeScript/JSON schema | Versioned request/response types shared by Studio and agent |

The Railway service must never attempt to patch a Spotify Desktop installation. Spotify Desktop and the Spicetify CLI remain on the user's Windows machine. Railway hosts only the web-facing Studio services and any stateless coordination/API functionality.

## Player support

Treat the two playback targets as separate integrations:

1. **Spotify Desktop:** detected and managed only through the Windows agent. The agent invokes supported Spicetify CLI commands and reports state to Studio.
2. **Spotify Web Player:** use Spotify's supported web integration surfaces. Do not claim that Spicetify themes, extensions, or desktop patching can be applied to the Spotify web player. Playback capabilities, account requirements, and Spotify developer restrictions must be validated before enabling any control surface.

## Local-agent security boundary

- Bind to loopback only; never listen on `0.0.0.0` or a public interface.
- Pair Studio with the local agent using a one-time, short-lived pairing code and a local confirmation step.
- Use a versioned, typed, allowlisted API. Never expose arbitrary shell, PowerShell, or command execution.
- Run in the signed-in Windows user's context. Never elevate by default and never pass `--bypass-admin`.
- Start with read-only discovery and health reporting. Require a separate explicit confirmation for backup, apply, restore, or other state-changing actions.
- Validate every path against expected Spotify/Spicetify locations; reject traversal and unexpected executables.
- Redact credentials, authorization codes, and Spotify content from logs.
- Provide clear errors and preserve backup/restore workflows; never silently retry destructive actions.
- Studio must continue to function in disconnected mode when the Windows agent is offline.

## Railway deployment boundary

- Deploy `studio/` as its own Railway service with the Studio directory as the service root.
- Do not deploy the Windows agent to Railway.
- Do not add a Docker `VOLUME` instruction for the local Spotify library; no Spotify library is stored in Railway.
- Keep secrets in Railway variables, never in Git.
- Use a health endpoint and explicit start/build commands. Confirm the framework and package manager before configuring deployment.
- Keep local-agent pairing and browser sessions separate from Spotify OAuth tokens.

## Branch and pull-request strategy

- Keep `main` deployable and protected by review/CI.
- Use focused branches: `feat/studio-web-foundation`, `feat/windows-agent-foundation`, and `feat/player-integrations`.
- Never commit generated Spotify application assets, local profiles, tokens, or personal configuration.
- Each PR must state its component, user-visible behavior, security impact, migration/deployment impact, and rollback path.
- Merge only after CI passes and the changed component has a manual smoke-test checklist.

## Build and validation checks

### Existing CLI
- Preserve the current Go build and Windows CLI smoke-test workflow.
- Keep existing wrapper lint/format/build checks passing.
- Do not run Spotify install, backup, apply, or restore in CI.

### Studio
- Install from the committed lockfile with a frozen lockfile.
- Run type-check, lint, unit tests, and production build.
- Verify the health endpoint and Railway start command.
- Test disconnected-agent behavior and responsive desktop/mobile layouts.

### Windows agent
- Build and test on Windows runners using the Go version declared by its module.
- Unit-test loopback-only binding, pairing expiry, origin checks, path validation, authorization, and rejection of arbitrary command payloads.
- Add integration tests using mocked Spicetify executables; CI must not modify a real Spotify installation.
- Smoke-test detection and version reporting under a standard, non-administrator user.

## First implementation milestone: read-only foundation

Deliver a minimal end-to-end foundation before adding theme installation or playback control:

1. Add a standalone Studio web app under `studio/` with a modern responsive status screen.
2. Add a Windows agent under `agent/windows/` that reports agent health, Windows platform, detected Spicetify CLI version, detected Spotify path, and whether the process is elevated.
3. Expose only a loopback health/status API with a short-lived local pairing flow; no arbitrary command endpoint.
4. Add shared versioned contracts and clear disconnected / not-paired / paired states in Studio.
5. Add component-specific CI without changing the root CLI's build or runtime behavior.
6. Document local Windows setup and Railway deployment configuration. Do not create or change Railway services until the Studio build and service root are verified.

### Acceptance criteria

- Existing CLI behavior and root-level workflows remain unchanged.
- Studio builds independently and can deploy from `studio/`.
- The Windows agent runs as the signed-in user and never requires Administrator privileges.
- Studio can display agent connectivity and read-only local installation status.
- The agent rejects non-loopback connections, expired pairing codes, untrusted origins, and unknown operations.
- No Spotify account credentials, tokens, or personal library data are sent to Railway in this milestone.
- CI tests do not install, launch, back up, patch, or apply changes to Spotify.
