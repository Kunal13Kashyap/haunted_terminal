import { Router } from "express";
import { randomUUID } from "node:crypto";
import { processCommand } from "../services/story.service.js";

const router = Router();

router.post("/command", async (req, res) => {
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

  const id =
    typeof sessionId === "string" && sessionId.length <= 100
      ? sessionId
      : randomUUID();

  try {
    const result = await processCommand(command, id);

    res.json({
      sessionId: id,
      command: command.trim(),
      ...result,
    });
  } catch (error) {
    console.error("Terminal command failed:", error.message);

    res.status(502).json({
      sessionId: id,
      type: "error",
      error: "The ghost could not respond. Check that Ollama is running.",
    });
  }
});

export default router;