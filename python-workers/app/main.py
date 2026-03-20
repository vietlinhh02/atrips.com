"""FastAPI app for browser-use worker service."""

from __future__ import annotations

import asyncio
import logging

import app.playwright_patch  # noqa: F401 — must load before browser-use

from fastapi import FastAPI, HTTPException

from app.config import MAX_CONCURRENT_BROWSERS
from app.schemas import HealthResponse, TaskRequest, TaskResult
from app.worker import run_browser_task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="ATrips Browser Workers", version="1.0.0")

# Semaphore to cap concurrent browser instances
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_BROWSERS)
_active_tasks = 0


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        active_tasks=_active_tasks,
        max_concurrent=MAX_CONCURRENT_BROWSERS,
    )


@app.post("/tasks", response_model=TaskResult)
async def create_task(request: TaskRequest) -> TaskResult:
    global _active_tasks

    # Queue tasks via semaphore instead of rejecting
    async with _semaphore:
        _active_tasks += 1
        try:
            logger.info(
                "Starting task %s (type=%s, query=%s)",
                request.task_id,
                request.task_type,
                request.query[:60],
            )
            result = await run_browser_task(request)
            return TaskResult(**result)
        finally:
            _active_tasks -= 1
