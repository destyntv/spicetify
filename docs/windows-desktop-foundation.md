# Windows Desktop Foundation

This document records the first Windows-focused integration milestone for the Spicetify CLI fork.

## Scope

The first milestone is deliberately read-only with respect to the installed Spotify client. It establishes that the existing CLI can be built and smoke-tested on Windows before any desktop dashboard or local agent is introduced.

In scope:

- Build the existing Go CLI for Windows x64 in continuous integration.
- Run the CLI's built-in `--version` and `--help` entry points as smoke checks.
- Document a safe local verification sequence for Windows 10/11.
- Define the safety boundary for future desktop-agent integration.

Out of scope:

- Installing or modifying Spotify.
- Running `spicetify backup`, `spicetify apply`, `spicetify restore`, or other state-changing commands as part of CI.
- Adding a background service, localhost API, dashboard, OAuth flow, or automatic theme/extension installation.
- Requiring administrator privileges.

## Windows developer prerequisites

- Windows 10 or Windows 11.
- Go version specified by the repository's `go.mod`.
- Git.
- PowerShell 5.1 or newer.

Node.js and pnpm are required only when changing the JavaScript wrapper or running the repository's wrapper checks.

## Build and smoke-test

From the repository root in PowerShell:

```powershell
go version
go build -o .\\spicetify.exe .
.\\spicetify.exe --version
.\\spicetify.exe --help
Remove-Item .\\spicetify.exe
```

These checks compile the CLI and exercise its informational entry points. They do not install, back up, patch, or apply changes to Spotify.

## Safe desktop verification

Before any future integration is allowed to modify a user's desktop:

1. Detect Spotify and Spicetify paths without writing to them.
2. Display the detected paths and installed versions to the user.
3. Require an explicit user action for every state-changing operation.
4. Use the existing Spicetify CLI for supported operations rather than duplicating its patching logic.
5. Never run the CLI as Administrator by default. The CLI itself warns against elevated execution.
6. Provide a backup/restore path and report failures without silently retrying destructive operations.

## Future local-agent boundary

A future Studio desktop agent should:

- Bind only to loopback interfaces.
- Require an explicit pairing flow and short-lived authorization.
- Expose typed, allowlisted operations rather than arbitrary shell or PowerShell execution.
- Validate file paths and reject path traversal.
- Keep Spotify content, credentials, and user tokens out of logs.
- Confirm destructive operations and preserve the user's ability to cancel.
- Run in the signed-in user's context, not as an elevated service.

This milestone does not implement that agent. The boundary is documented here so later work can be reviewed against it.

## Acceptance criteria

- The Windows CI workflow builds the CLI using the Go version from `go.mod`.
- The generated executable successfully runs `--version` and `--help`.
- CI does not install, launch, or modify Spotify.
- No repository changes are applied directly to the default branch.
