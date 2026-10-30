import { Router } from "express";
import { getSessionById } from "../repositories/session.repository.js";
import { getAllMessages } from "../repositories/message.repository.js";
import { getTerminalEvents } from "../repositories/terminal-event.repository.js";

const router = Router();

router.get("/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const isValidSessionId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    sessionId
  );

  if (!isValidSessionId) {
    return res.status(400).json({
      error: "Invalid session ID.",
    });
  }

  try {
    const session = await getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    const messages = await getAllMessages(sessionId);
    const events = await getTerminalEvents(sessionId);

    res.json({
      sessionId: session.id,
      status: session.status,
      ending: session.ending,
      discoveredClues: session.clues.map(
        (clue) => clue.clueId
      ),
      sessionEnded: session.status !== "ACTIVE",
      messages,
      events,
    });
  } catch (error) {
    console.error("Session retrieval failed:", error);

    res.status(500).json({
      error: "Could not retrieve session.",
    });
  }
});

export default router;
