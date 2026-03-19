"""Patch playwright for Docker compatibility.

1. Strips deprecated 'devtools' kwarg (removed in Playwright 1.50+)
2. Injects '--no-sandbox' for running as root in Docker containers

Import this module before any browser-use code runs.
"""

from __future__ import annotations

import logging

from playwright.async_api import BrowserType

logger = logging.getLogger(__name__)

_original_launch_persistent_context = BrowserType.launch_persistent_context

_REMOVED_KWARGS = {"devtools"}

_DOCKER_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"]


async def _patched_launch_persistent_context(
    self: BrowserType,
    user_data_dir: str,
    **kwargs,
):
    # Strip deprecated kwargs
    removed = {k: kwargs.pop(k) for k in _REMOVED_KWARGS if k in kwargs}
    if removed:
        logger.debug("Stripped deprecated playwright kwargs: %s", list(removed))

    # Inject --no-sandbox for Docker (root user)
    args = list(kwargs.get("args", []))
    for arg in _DOCKER_ARGS:
        if arg not in args:
            args.append(arg)
    kwargs["args"] = args

    # Disable Chromium sandbox via Playwright option too
    if "chromium_sandbox" not in kwargs:
        kwargs["chromium_sandbox"] = False

    return await _original_launch_persistent_context(
        self, user_data_dir, **kwargs
    )


BrowserType.launch_persistent_context = _patched_launch_persistent_context  # type: ignore[assignment]
