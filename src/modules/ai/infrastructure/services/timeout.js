/**
 * Timeout Configuration
 * Env-configurable timeout for AI SDK calls (total + per-step).
 * Adapted from reference implementation's timeout pattern.
 */

const MIN_TIMEOUT_MS = 5_000;

function parseTimeoutEnv(name, fallback) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(MIN_TIMEOUT_MS, fallback);
  }
  return Math.max(MIN_TIMEOUT_MS, Math.round(parsed));
}

function normalizeTimeoutMs(value) {
  if (!Number.isFinite(value) || value <= 0) return MIN_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.round(value));
}

/** Default per-step timeout (env: AI_STEP_TIMEOUT_MS, default: 120s) */
export const DEFAULT_STEP_TIMEOUT_MS = parseTimeoutEnv('AI_STEP_TIMEOUT_MS', 120_000);

/** Default total timeout (env: AI_TOTAL_TIMEOUT_MS, default: 300s) */
export const DEFAULT_TOTAL_TIMEOUT_MS = parseTimeoutEnv('AI_TOTAL_TIMEOUT_MS', 300_000);

/**
 * Build a TimeoutConfiguration for AI SDK.
 * @param {number} [totalMs] - Total timeout in milliseconds
 * @param {number} [stepMs] - Per-step timeout in milliseconds
 * @returns {{ totalMs: number, stepMs: number } | undefined}
 */
export function buildTimeoutConfig(totalMs, stepMs) {
  const total = totalMs != null ? normalizeTimeoutMs(totalMs) : DEFAULT_TOTAL_TIMEOUT_MS;
  const step = stepMs != null
    ? Math.min(total, normalizeTimeoutMs(stepMs))
    : Math.min(total, DEFAULT_STEP_TIMEOUT_MS);

  return { totalMs: total, stepMs: step };
}
