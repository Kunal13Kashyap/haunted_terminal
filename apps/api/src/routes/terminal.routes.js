import { Router } from "express";
import { processCommand } from "../services/story.service.js";
import { OllamaServiceError } from "../services/ollama.service.js";

const router = Router();

router.post("/command", async (req, res) => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      error: "Invalid request body.",
    });
  }

  const { command, sessionId } = req.body;

  if (typeof command !== "string" || !command.trim()) {
    return res.status(400).json({
      error: "A command is required.",
    });
  }

  if (command.length > 500) {
    return res.status(400).json({
      error: "Command is too long.",
    });
  }

  const isValidSessionId =
  typeof sessionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sessionId
    );

  if (!isValidSessionId) {
    return res.status(400).json({
      error: "Invalid session ID.",
    });
  }

  const id = sessionId;

  try {
    const result = await processCommand(command, id);

    res.json({
      sessionId: id,
      command: command.trim(),
      ...result,
    });
  } catch (error) {
    console.error("Terminal command failed:", error);

    if (error instanceof OllamaServiceError) {
      return res.status(503).json({
        sessionId: id,
        type: "error",
        error: "The ghost is temporarily unreachable. The signal has faded.",
      });
    }

    return res.status(500).json({
      sessionId: id,
      type: "error",
      error: "An internal system error occurred.",
    });
  }
});

export default router;