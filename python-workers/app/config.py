"""Worker service configuration."""

import os

# LLM provider — use dedicated fast model for browser navigation.
# WORKER_LLM_MODEL takes priority over OAI_MODEL (which may be a
# slow "thinking" model unsuitable for rapid browser step decisions).
LLM_MODEL = os.getenv(
    "WORKER_LLM_MODEL",
    os.getenv("OAI_FAST_MODEL", os.getenv("OAI_MODEL", "gpt-4o")),
)
LLM_API_KEY = os.getenv("OAI_API_KEY", os.getenv("OPENAI_API_KEY", "dummy"))
LLM_BASE_URL = os.getenv("OAI_BASE_URL", os.getenv("LLM_BASE_URL", None))
if LLM_BASE_URL and not LLM_BASE_URL.endswith("/v1"):
    LLM_BASE_URL = LLM_BASE_URL.rstrip("/") + "/v1"

# browser-use reads OPENAI_API_KEY from env directly
if LLM_API_KEY and not os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = LLM_API_KEY

# Browser Use Cloud (stealth browser, no CAPTCHA)
# Set BROWSER_USE_API_KEY to enable cloud mode
BROWSER_USE_CLOUD = bool(os.getenv("BROWSER_USE_API_KEY", ""))
BROWSER_USE_PROXY_COUNTRY = os.getenv("BROWSER_USE_PROXY_COUNTRY", "vn")

# Browser settings
MAX_CONCURRENT_BROWSERS = int(os.getenv("MAX_CONCURRENT_BROWSERS", "4"))
BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
TASK_TIMEOUT_SECONDS = int(os.getenv("TASK_TIMEOUT_SECONDS", "60"))
MAX_STEPS_PER_TASK = int(os.getenv("MAX_STEPS_PER_TASK", "15"))

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8500"))
