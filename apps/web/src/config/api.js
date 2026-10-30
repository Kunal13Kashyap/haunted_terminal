
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not configured.");
}

const baseUrl = API_BASE_URL.replace(/\/+$/, "");

export const MIN_RESPONSE_DELAY = Number(
  import.meta.env.VITE_MIN_RESPONSE_DELAY ?? 3000
);

if (
  !Number.isFinite(MIN_RESPONSE_DELAY) ||
  MIN_RESPONSE_DELAY < 0
) {
  throw new Error("VITE_MIN_RESPONSE_DELAY must be a valid non-negative number.");
}

export const API_ENDPOINTS = Object.freeze({
  HEALTH: `${baseUrl}/api/health`,
  TERMINAL_COMMAND: `${baseUrl}/api/terminal/command`,
  SESSION: (sessionId) =>
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`,
});
