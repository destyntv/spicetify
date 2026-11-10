const toast = document.querySelector("#toast");
const clientIdInput = document.querySelector("#spotify-client-id");
const connectButton = document.querySelector("#connect-spotify");
const disconnectButton = document.querySelector("#disconnect-spotify");
const configurePanel = document.querySelector("#spotify-config");
const profileLabel = document.querySelector("#spotify-profile");

const STORAGE = {
  clientId: "spicetify-studio.spotify-client-id",
  accessToken: "spicetify-studio.spotify-access-token",
  refreshToken: "spicetify-studio.spotify-refresh-token",
  expiresAt: "spicetify-studio.spotify-expires-at",
  verifier: "spicetify-studio.spotify-code-verifier",
  state: "spicetify-studio.spotify-oauth-state"
};

function showMessage(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  window.clearTimeout(showMessage.timeout);
  showMessage.timeout = window.setTimeout(() => toast.classList.remove("show"), 5000);
}

function setPill(selector, label, state = "neutral") {
  const pill = document.querySelector(selector);
  if (!pill) return;
  pill.className = `status-pill ${state}`;
  pill.innerHTML = `<i aria-hidden="true"></i><span class="status-label">${label}</span>`;
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function redirectUri() {
  return `${window.location.origin}/`;
}

function setConnected(profile) {
  setPill(".web-card .status-pill", "Connected", "connected");
  if (profileLabel) {
    const displayName = profile.display_name || profile.id || "Spotify account";
    profileLabel.textContent = `Connected as ${displayName}`;
    profileLabel.hidden = false;
  }
  if (connectButton) connectButton.hidden = true;
  if (disconnectButton) disconnectButton.hidden = false;
}

function setDisconnected() {
  setPill(".web-card .status-pill", "Not connected", "neutral");
  if (profileLabel) {
    profileLabel.textContent = "";
    profileLabel.hidden = true;
  }
  if (connectButton) connectButton.hidden = false;
  if (disconnectButton) disconnectButton.hidden = true;
}

async function exchangeAuthorizationCode(code) {
  const clientId = localStorage.getItem(STORAGE.clientId);
  const verifier = sessionStorage.getItem(STORAGE.verifier);
  if (!clientId || !verifier) throw new Error("Spotify setup expired. Please connect again.");

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier
  });
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || "Spotify sign-in failed.");

  sessionStorage.setItem(STORAGE.accessToken, result.access_token);
  if (result.refresh_token) sessionStorage.setItem(STORAGE.refreshToken, result.refresh_token);
  sessionStorage.setItem(STORAGE.expiresAt, String(Date.now() + result.expires_in * 1000));
  sessionStorage.removeItem(STORAGE.verifier);
  sessionStorage.removeItem(STORAGE.state);
}

async function accessToken() {
  const token = sessionStorage.getItem(STORAGE.accessToken);
  const expiresAt = Number(sessionStorage.getItem(STORAGE.expiresAt) || 0);
  if (token && Date.now() < expiresAt - 60_000) return token;

  const refreshToken = sessionStorage.getItem(STORAGE.refreshToken);
  const clientId = localStorage.getItem(STORAGE.clientId);
  if (!refreshToken || !clientId) return token;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || "Spotify session expired. Please reconnect.");
  sessionStorage.setItem(STORAGE.accessToken, result.access_token);
  if (result.refresh_token) sessionStorage.setItem(STORAGE.refreshToken, result.refresh_token);
  sessionStorage.setItem(STORAGE.expiresAt, String(Date.now() + result.expires_in * 1000));
  return result.access_token;
}

async function loadSpotifyProfile() {
  const token = await accessToken();
  if (!token) {
    setDisconnected();
    return;
  }
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) {
    sessionStorage.removeItem(STORAGE.accessToken);
    sessionStorage.removeItem(STORAGE.refreshToken);
    sessionStorage.removeItem(STORAGE.expiresAt);
    setDisconnected();
    throw new Error("Spotify session expired. Please connect again.");
  }
  if (!response.ok) throw new Error(`Could not verify Spotify account (${response.status}).`);
  setConnected(await response.json());
}

async function connectSpotify() {
  const clientId = localStorage.getItem(STORAGE.clientId);
  if (!clientId) {
    if (configurePanel) configurePanel.hidden = false;
    clientIdInput?.focus();
    showMessage("Add your Spotify Developer app Client ID to continue.");
    return;
  }

  const verifier = randomString(48);
  const state = randomString(24);
  sessionStorage.setItem(STORAGE.verifier, verifier);
  sessionStorage.setItem(STORAGE.state, state);
  const challenge = await createCodeChallenge(verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: "user-read-private user-read-email"
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function handleOAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const code = params.get("code");
  if (!error && !code) return;

  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  if (error) {
    sessionStorage.removeItem(STORAGE.verifier);
    sessionStorage.removeItem(STORAGE.state);
    throw new Error(error === "access_denied" ? "Spotify sign-in was cancelled." : `Spotify sign-in error: ${error}`);
  }
  if (params.get("state") !== sessionStorage.getItem(STORAGE.state)) {
    throw new Error("Spotify sign-in could not be verified. Please try again.");
  }
  await exchangeAuthorizationCode(code);
}

async function refreshStatus() {
  const refreshButton = document.querySelector("#refresh-status");
  if (refreshButton) refreshButton.disabled = true;
  try {
    const response = await fetch("/api/status", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Status request failed (${response.status}).`);
    const data = await response.json();
    const agentState = data.agent?.state === "not-paired" ? "Agent not paired" : "Agent status unavailable";
    setPill(".desktop-card .status-pill", agentState, "pending");
    showMessage("Studio status refreshed.");
  } catch (error) {
    showMessage(error.message || "Could not refresh Studio status. Check your connection and retry.", true);
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

document.querySelector("#refresh-status")?.addEventListener("click", refreshStatus);
document.querySelector("#pair-agent")?.addEventListener("click", () => {
  showMessage("Windows agent pairing is not available yet. Desktop changes remain local to your PC; no remote commands were run.");
});
document.querySelector("#connect-spotify")?.addEventListener("click", () => {
  connectSpotify().catch((error) => showMessage(error.message, true));
});
document.querySelector("#disconnect-spotify")?.addEventListener("click", () => {
  for (const key of [STORAGE.accessToken, STORAGE.refreshToken, STORAGE.expiresAt, STORAGE.verifier, STORAGE.state]) {
    sessionStorage.removeItem(key);
  }
  setDisconnected();
  showMessage("Spotify account disconnected from this browser session.");
});
document.querySelector("#save-spotify-config")?.addEventListener("click", () => {
  const value = clientIdInput?.value.trim();
  if (!value) {
    showMessage("Enter your Spotify Developer app Client ID.", true);
    clientIdInput?.focus();
    return;
  }
  localStorage.setItem(STORAGE.clientId, value);
  if (configurePanel) configurePanel.hidden = true;
  showMessage("Spotify Client ID saved in this browser. You can now connect.");
});

if (clientIdInput) clientIdInput.value = localStorage.getItem(STORAGE.clientId) || "";
const redirectUriLabel = document.querySelector("#redirect-uri");
if (redirectUriLabel) redirectUriLabel.textContent = redirectUri();

(async () => {
  try {
    await handleOAuthReturn();
    await loadSpotifyProfile();
  } catch (error) {
    setDisconnected();
    showMessage(error.message || "Spotify connection failed.", true);
  }
  await refreshStatus();
})();


// Optional spotDL engine. Requests stay same-origin; the worker API key remains server-side.
const spotdlStatus = document.querySelector("#spotdl-status");
const spotdlForm = document.querySelector("#spotdl-form");
const spotdlAccessKey = document.querySelector("#spotdl-access-key");
const SPOTDL_ACCESS_SESSION_KEY = "spicetify-studio.download-access-key";
const spotdlSubmit = document.querySelector("#spotdl-submit");
const spotdlJob = document.querySelector("#spotdl-job");

async function refreshSpotdlStatus() {
  if (!spotdlStatus) return;
  try {
    const response = await fetch("/api/status", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Studio status request failed (" + response.status + ")");
    const data = await response.json();
    const configured = data.downloads?.spotdl?.state === "configured";
    const label = spotdlStatus.querySelector(".status-label");
    if (label) label.textContent = configured ? "Ready" : "Not configured";
    spotdlStatus.classList.toggle("ready", configured);
    spotdlStatus.classList.toggle("pending", !configured);
  } catch (error) {
    const label = spotdlStatus.querySelector(".status-label");
    if (label) label.textContent = "Status unavailable";
    showMessage(error.message || "Could not check spotDL worker.", true);
  }
}

async function pollSpotdlJob(jobId, attempts = 0) {
  if (attempts >= 120) {
    if (spotdlJob) spotdlJob.textContent = "Still processing. The worker continues independently; submit another status check later.";
    return;
  }
  try {
    const response = await fetch("/api/downloads/" + encodeURIComponent(jobId), {
      headers: { Accept: "application/json", "X-Studio-Download-Key": sessionStorage.getItem(SPOTDL_ACCESS_SESSION_KEY) || "" },
      cache: "no-store"
    });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || job.detail || "Job status request failed (" + response.status + ")");
    if (spotdlJob) spotdlJob.textContent = "spotDL job " + job.id + ": " + job.status + (job.log ? "\n" + job.log : "");
    if (job.status === "queued" || job.status === "running") {
      window.setTimeout(() => pollSpotdlJob(jobId, attempts + 1), 3000);
    }
  } catch (error) {
    if (spotdlJob) spotdlJob.textContent = "Could not read spotDL job status: " + error.message;
  }
}

if (spotdlForm) {
  spotdlForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = new FormData(spotdlForm).get("url")?.toString().trim();
    const accessKey = spotdlAccessKey?.value.trim() || sessionStorage.getItem(SPOTDL_ACCESS_SESSION_KEY) || "";
    if (!url || !accessKey || !spotdlSubmit || !spotdlJob) {
      if (spotdlJob) spotdlJob.textContent = "Enter the Studio download access key and a Spotify link.";
      spotdlAccessKey?.focus();
      return;
    }
    sessionStorage.setItem(SPOTDL_ACCESS_SESSION_KEY, accessKey);
    spotdlSubmit.disabled = true;
    spotdlJob.textContent = "Submitting to spotDL…";
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Studio-Download-Key": accessKey },
        body: JSON.stringify({ url })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.detail || "Download request failed (" + response.status + ")");
      spotdlForm.reset();
      spotdlJob.textContent = "spotDL job " + payload.id + ": queued";
      pollSpotdlJob(payload.id);
    } catch (error) {
      spotdlJob.textContent = "Download could not be queued: " + error.message;
    } finally {
      spotdlSubmit.disabled = false;
    }
  });
}

if (spotdlAccessKey) spotdlAccessKey.value = sessionStorage.getItem(SPOTDL_ACCESS_SESSION_KEY) || "";
refreshSpotdlStatus();
