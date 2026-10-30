import "dotenv/config";

function getNumber(name, defaultValue) {
  const value = Number(process.env[name] ?? defaultValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid environment variable: ${name}`);
  }

  return value;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

export const env = Object.freeze({
  PORT: getNumber("PORT", 3000),

  WEB_ORIGIN:
    process.env.WEB_ORIGIN || "http://localhost:5173",

  DATABASE_URL: databaseUrl,

  OLLAMA_HOST:
    process.env.OLLAMA_HOST || "http://127.0.0.1:11434",

  OLLAMA_MODEL:
    process.env.OLLAMA_MODEL || "qwen2.5:3b",

  MAX_RESPONSE_WORDS:
    getNumber("MAX_RESPONSE_WORDS", 65),

  MIN_RESPONSE_DELAY:
    getNumber("MIN_RESPONSE_DELAY", 3000),
});
