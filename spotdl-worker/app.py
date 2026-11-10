from __future__ import annotations

import os
import re
import secrets
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

OUTPUT_DIR = Path(os.getenv("SPOTDL_OUTPUT_DIR", "/music")).resolve()
API_KEY = os.getenv("SPOTDL_API_KEY", "")
MAX_PENDING_JOBS = int(os.getenv("SPOTDL_MAX_PENDING_JOBS", "100"))
JOB_LOG_LIMIT = 4000

app = FastAPI(title="Spicetify Studio spotDL Worker", version="0.1.0")
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="spotdl")
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


class JobRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


def validate_spotify_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme != "https" or parsed.hostname != "open.spotify.com":
        raise ValueError("Only https://open.spotify.com links are accepted")

    parts = [part for part in parsed.path.split("/") if part]
    resource_index = next(
        (i for i, part in enumerate(parts) if part in {"track", "album", "playlist", "artist"}),
        -1,
    )
    if resource_index < 0 or resource_index + 1 >= len(parts):
        raise ValueError("Use a Spotify track, album, playlist, or artist URL")

    resource_id = parts[resource_index + 1]
    if not re.fullmatch(r"[A-Za-z0-9]{22}", resource_id):
        raise ValueError("The Spotify link does not contain a valid resource ID")

    return f"https://open.spotify.com/{parts[resource_index]}/{resource_id}"


def build_command(url: str, output_dir: Path = OUTPUT_DIR) -> list[str]:
    # Pass a fixed argument vector; never invoke a shell or accept user-supplied flags.
    return ["spotdl", "download", url, "--output", str(output_dir)]


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Worker API is not configured")
    expected = f"Bearer {API_KEY}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def run_job(job_id: str, url: str) -> None:
    with jobs_lock:
        jobs[job_id]["status"] = "running"

    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            build_command(url),
            capture_output=True,
            text=True,
            timeout=6 * 60 * 60,
            check=False,
            shell=False,
        )
        output = (result.stdout or "") + (result.stderr or "")
        with jobs_lock:
            jobs[job_id]["status"] = "completed" if result.returncode == 0 else "failed"
            jobs[job_id]["return_code"] = result.returncode
            jobs[job_id]["log"] = output[-JOB_LOG_LIMIT:]
    except subprocess.TimeoutExpired:
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["log"] = "Download exceeded the six-hour worker limit."
    except Exception as exc:  # Keep failure visible to the Studio UI.
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["log"] = f"Worker error: {type(exc).__name__}: {exc}"[-JOB_LOG_LIMIT:]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "spotdl-worker"}


@app.post("/api/jobs", dependencies=[Depends(require_api_key)], status_code=202)
def create_job(request: JobRequest) -> dict:
    try:
        url = validate_spotify_url(request.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    with jobs_lock:
        active = sum(job["status"] in {"queued", "running"} for job in jobs.values())
        if active >= MAX_PENDING_JOBS:
            raise HTTPException(status_code=429, detail="The spotDL queue is full")
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"id": job_id, "status": "queued", "url": url, "log": ""}
        executor.submit(run_job, job_id, url)

    return {"id": job_id, "status": "queued", "engine": "spotdl"}


@app.get("/api/jobs/{job_id}", dependencies=[Depends(require_api_key)])
def get_job(job_id: str) -> dict:
    with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Download job not found")
        return dict(job)
