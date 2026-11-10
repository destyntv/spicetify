const toast = document.querySelector("#toast");
const spotdlStatus = document.querySelector("#spotdl-status");
const spotdlForm = document.querySelector("#spotdl-form");
const spotdlSubmit = document.querySelector("#spotdl-submit");
const spotdlJob = document.querySelector("#spotdl-job");

async function refreshStatus() {
  try {
    const response = await fetch("/api/status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
    const data = await response.json();
    const agentState = data.agent?.state === "not-paired" ? "Agent not paired" : "Agent status unavailable";
    const desktopPill = document.querySelector(".desktop-card .status-pill");
    const webPill = document.querySelector(".web-card .status-pill");
    if (desktopPill) desktopPill.lastChild.textContent = ` ${agentState}`;
    if (webPill) webPill.lastChild.textContent = ` ${data.players?.web?.state === "not-connected" ? "Not connected" : "Status unavailable"}`;
    if (spotdlStatus) {
      const configured = data.downloads?.spotdl?.state === "configured";
      spotdlStatus.lastChild.textContent = configured ? " Ready" : " Not configured";
      spotdlStatus.classList.toggle("ready", configured);
      spotdlStatus.classList.toggle("pending", !configured);
    }
  } catch {
    if (toast) {
      toast.textContent = "Could not refresh Studio status";
      toast.classList.add("show");
    }
  }
}

async function pollSpotdlJob(jobId, attempts = 0) {
  if (attempts >= 120) {
    spotdlJob.textContent = "Still processing. Refresh the job later; the worker continues independently.";
    return;
  }
  try {
    const response = await fetch(`/api/downloads/${encodeURIComponent(jobId)}`, {
      headers: { Accept: "application/json" }
    });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || job.detail || `Job request failed: ${response.status}`);
    spotdlJob.textContent = `spotDL job ${job.id}: ${job.status}${job.log ? `\n${job.log}` : ""}`;
    if (job.status === "queued" || job.status === "running") {
      window.setTimeout(() => pollSpotdlJob(jobId, attempts + 1), 3000);
    }
  } catch (error) {
    spotdlJob.textContent = `Could not read spotDL job status: ${error.message}`;
  }
}

if (spotdlForm) {
  spotdlForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = new FormData(spotdlForm).get("url")?.toString().trim();
    if (!url) return;
    spotdlSubmit.disabled = true;
    spotdlJob.textContent = "Submitting to spotDL…";
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.detail || `Download request failed: ${response.status}`);
      spotdlForm.reset();
      spotdlJob.textContent = `spotDL job ${payload.id}: queued`;
      pollSpotdlJob(payload.id);
    } catch (error) {
      spotdlJob.textContent = `Download could not be queued: ${error.message}`;
    } finally {
      spotdlSubmit.disabled = false;
    }
  });
}

refreshStatus();
