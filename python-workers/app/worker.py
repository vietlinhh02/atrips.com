"""Browser worker — runs browser-use agent for each task."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from browser_use import Agent, Browser
from langchain_openai import ChatOpenAI

from app.config import (
    BROWSER_HEADLESS,
    BROWSER_USE_CLOUD,
    BROWSER_USE_PROXY_COUNTRY,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    MAX_STEPS_PER_TASK,
    TASK_TIMEOUT_SECONDS,
)
from app.schemas import TaskRequest, TaskType

logger = logging.getLogger(__name__)

# Task-type config: prompt template + start URL to skip navigation
TASK_CONFIG: dict[TaskType, dict[str, str]] = {
    TaskType.HOTELS: {
        "prompt": (
            "Find the best hotels for: {query}. "
            "Extract at least 5 with: name, price, rating, address, amenities. "
            "Context: {context}"
        ),
        "start_url": "https://www.booking.com",
    },
    TaskType.RESTAURANTS: {
        "prompt": (
            "Find the best restaurants/cafes for: {query}. "
            "Extract at least 5 with: name, cuisine, price range, rating, address, hours. "
            "Context: {context}"
        ),
        "start_url": "https://www.google.com/maps",
    },
    TaskType.ATTRACTIONS: {
        "prompt": (
            "Find top tourist attractions for: {query}. "
            "Extract at least 5 with: name, description, entrance fee, hours, address. "
            "Context: {context}"
        ),
        "start_url": "https://www.google.com/maps",
    },
    TaskType.TRANSPORT: {
        "prompt": (
            "Find transportation options for: {query}. "
            "Include routes, prices, schedules. "
            "Context: {context}"
        ),
        "start_url": "https://www.rome2rio.com",
    },
    TaskType.ACTIVITIES: {
        "prompt": (
            "Find activities and experiences for: {query}. "
            "Extract at least 5 with: name, price, duration, reviews. "
            "Context: {context}"
        ),
        "start_url": "https://www.klook.com",
    },
    TaskType.NIGHTLIFE: {
        "prompt": (
            "Find nightlife options for: {query}. "
            "Include bars, clubs, night markets with name, hours, location. "
            "Context: {context}"
        ),
        "start_url": "https://www.tripadvisor.com",
    },
    TaskType.CUSTOM: {
        "prompt": "Complete this task: {query}. Context: {context}",
        "start_url": "https://duckduckgo.com",
    },
}


def _build_llm() -> ChatOpenAI:
    kwargs: dict[str, Any] = {
        "model": LLM_MODEL,
        "api_key": LLM_API_KEY,
        "temperature": 0.2,
    }
    if LLM_BASE_URL:
        kwargs["base_url"] = LLM_BASE_URL
    return ChatOpenAI(**kwargs)


def _build_browser() -> Browser:
    if BROWSER_USE_CLOUD:
        logger.info("Using Browser Use Cloud (stealth mode)")
        return Browser(
            use_cloud=True,
            cloud_proxy_country_code=BROWSER_USE_PROXY_COUNTRY,
        )
    return Browser(
        headless=BROWSER_HEADLESS,
        extra_chromium_args=["--no-sandbox", "--disable-setuid-sandbox"],
    )


def _build_prompt(task: TaskRequest) -> str:
    config = TASK_CONFIG.get(task.task_type, TASK_CONFIG[TaskType.CUSTOM])
    context_str = ", ".join(
        f"{k}: {v}" for k, v in task.context.items()
    ) if task.context else "none"
    return config["prompt"].format(query=task.query, context=context_str)


def _get_start_url(task: TaskRequest) -> str | None:
    config = TASK_CONFIG.get(task.task_type, TASK_CONFIG[TaskType.CUSTOM])
    return config.get("start_url")


async def run_browser_task(task: TaskRequest) -> dict[str, Any]:
    """Run a single browser-use agent task with timeout."""
    prompt = _build_prompt(task)
    start_url = _get_start_url(task)
    llm = _build_llm()
    browser = _build_browser()

    # Prepend start URL instruction to skip navigation
    if start_url:
        prompt = f"Go to {start_url} first, then: {prompt}"

    try:
        agent = Agent(
            task=prompt,
            llm=llm,
            browser=browser,
        )

        history = await asyncio.wait_for(
            agent.run(max_steps=MAX_STEPS_PER_TASK),
            timeout=TASK_TIMEOUT_SECONDS,
        )

        # Try final_result first, fallback to extracted content
        result = history.final_result()
        if not result:
            extracted = []
            for item in history.history:
                if hasattr(item, 'result') and item.result:
                    for r in item.result:
                        if hasattr(r, 'extracted_content') and r.extracted_content:
                            extracted.append(r.extracted_content)
            result = "\n\n".join(extracted) if extracted else None

        return {
            "taskId": task.task_id,
            "status": "success",
            "data": result,
        }

    except asyncio.TimeoutError:
        logger.warning(
            "Task %s timed out after %ds", task.task_id, TASK_TIMEOUT_SECONDS,
        )
        return {
            "taskId": task.task_id,
            "status": "timeout",
            "data": None,
            "error": f"Task timed out after {TASK_TIMEOUT_SECONDS}s",
        }
    except Exception as exc:
        logger.exception("Task %s failed", task.task_id)
        return {
            "taskId": task.task_id,
            "status": "error",
            "data": None,
            "error": str(exc),
        }
    finally:
        await browser.close()
