const toast = document.querySelector("#toast");

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
  } catch {
    if (toast) toast.textContent = "Could not refresh Studio status";
  }
}

refreshStatus();
