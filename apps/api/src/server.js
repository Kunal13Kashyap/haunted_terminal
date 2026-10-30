import express from "express";
import cors from "cors";
import terminalRoutes from "./routes/terminal.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import { env } from "./config/env.js";
import { rateLimit } from "express-rate-limit";

const app = express();
const terminalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many commands. Please wait a minute before trying again.",
  },
});

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Haunted Terminal API",
  });
});

app.use("/api/terminal", terminalLimiter, terminalRoutes);
app.use("/api/sessions", sessionRoutes);

// Handle unexpected errors from API routes and middleware.
app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);

  if (res.headersSent) return next(err);

  // Malformed JSON sent by the client
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON request body.",
    });
  }

  // Request body exceeds Express's configured size limit
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large.",
    });
  }

  // Unexpected server errors
  res.status(500).json({
    error: "An unexpected internal server error occurred.",
  });
});

app.listen(env.PORT, "127.0.0.1", () => {
  console.log(`👻 Haunted Terminal API: http://127.0.0.1:${env.PORT}`);
});