import { story } from "../data/story.js";
import { generateGhostResponse } from "./ollama.service.js";
import { saveTerminalEvent } from "../repositories/terminal-event.repository.js";

import { getOrCreateSession, updateSession } from "../repositories/session.repository.js";
import {
  saveConversationTurn,
  getRecentMessages,
} from "../repositories/message.repository.js";
import {
  saveDiscoveredClue,
  getDiscoveredClueIds,
} from "../repositories/clue.repository.js";
import { env } from "../config/env.js";

function waitForMinimumDelay(startTime) {
  const elapsed = Date.now() - startTime;
  const remaining = env.MIN_RESPONSE_DELAY - elapsed;

  if (remaining > 0) {
    return new Promise((resolve) => setTimeout(resolve, remaining));
  }

  return Promise.resolve();
}

// Load the complete gameplay state from SQLite.
async function loadSession(sessionId) {
  const record = await getOrCreateSession(sessionId);

  const [clues, history] = await Promise.all([
    getDiscoveredClueIds(sessionId),
    getRecentMessages(sessionId, 8),
  ]);

  return {
    clues,
    history,
    ended: record.status !== "ACTIVE",
    ending: record.ending,
  };
}

function getEvidence(session) {
  return story.clues
    .filter((clue) => session.clues.includes(clue.id))
    .map((clue) => `[${clue.id}] ${clue.title}: ${clue.message}`)
    .join("\n");
}

function missingRequirements(session, requirements = []) {
  return requirements.filter((id) => !session.clues.includes(id));
}

async function discoverClue(sessionId, session, clue) {
  if (session.clues.includes(clue.id)) {
    return {
      type: "clue",
      clueId: clue.id,
      discovered: false,
      output: `[ALREADY RECOVERED] ${clue.title}\n\n${clue.message}`,
    };
  }

  // Persist before returning the successful discovery response.
  await saveDiscoveredClue(sessionId, clue.id);

  session.clues.push(clue.id);

  return {
    type: "clue",
    clueId: clue.id,
    discovered: true,
    optional: clue.optional,
    output: `[MEMORY RECOVERED] ${clue.title}\n\n${clue.message}`,
  };
}

function getMissingClueNames(session, requirements) {
  return story.clues
    .filter((clue) => requirements.includes(clue.id))
    .filter((clue) => !session.clues.includes(clue.id))
    .map((clue) => clue.command);
}

function showEndingChoices() {
  return {
    type: "choice",
    output: [
      "FINAL MEMORY RESTORED.",
      "",
      "The process is waiting for your decision.",
      "",
      "terminate  — Shut down the process.",
      "preserve   — Keep the archive running.",
      "release    — Let the process go. (Requires the hidden memory.)",
      "",
      "Choose carefully. This cannot be undone.",
    ].join("\n"),
  };
}

function getGuardedResponse(command, session) {
  const asksAboutVoss =
    /\b(elian voss|dr\.?\s+elian|voss)\b/i.test(command);

  const knowsIdentity = session.clues.includes("identity");

  if (asksAboutVoss && !knowsIdentity) {
    return "That name stirs something I cannot place. No identity record has been recovered yet. Find the missing records; perhaps they will tell us why it matters.";
  }

  return null;
}

async function persistConversation(session, sessionId, command, answer) {
  await saveConversationTurn(sessionId, command, answer);

  session.history.push(
    { role: "user", content: command },
    { role: "assistant", content: answer }
  );

  // Keep only the most recent eight messages in working memory.
  session.history = session.history.slice(-8);
}

async function processCommandInternal(command, sessionId) {
  const normalized = command.trim().toLowerCase();

  if (!normalized) {
    return {
      type: "error",
      output: "The machine heard nothing.",
    };
  }

  const session = await loadSession(sessionId);

  if (session.ended) {
    return {
      type: "error",
      sessionEnded: true,
      output: "THIS SESSION HAS ENDED. Restart the experience to return.",
    };
  }

  if (normalized === "help") {
    return {
      type: "system",
      output: [
        "AVAILABLE COMMANDS",
        "",
        "help         — List commands",
        "scan         — Detect the unknown process",
        "logs         — Recover the shutdown warning",
        "investigate  — Examine the deleted identity",
        "reconstruct  — Compare contradictory records",
        "recover      — Search for a hidden memory",
        "whisper      — Listen to the ghost",
        "ask <text>   — Ask the ghost a question",
        "reveal       — Restore the final memory",
        "terminate    — End the process",
        "preserve     — Keep the process alive",
        "release      — Free the process (hidden ending)",
        "clear        — Clear terminal output",
        "exit         — End this session",
      ].join("\n"),
    };
  }

  if (normalized === "clear") {
    return {
      type: "clear",
      output: "",
    };
  }

  if (normalized === "exit") {
    await updateSession(sessionId, {
      status: "ENDED",
      endedAt: new Date(),
    });

    return {
      type: "system",
      sessionEnded: true,
      output: "SESSION TERMINATED. The machine remains awake.",
    };
  }

  const clue = story.clues.find(
    (item) => item.command === normalized
  );

  if (clue) {
    const missing = missingRequirements(session, clue.requires);

    if (missing.length > 0) {
      const requiredCommands = getMissingClueNames(session, missing);

      return {
        type: "warning",
        output: `MEMORY LOCKED. Recover these first: ${requiredCommands.join(", ")}.`,
      };
    }

    return discoverClue(sessionId, session, clue);
  }

  if (normalized === "reveal") {
    const missing = missingRequirements(
      session,
      story.ending.requires
    );

    if (missing.length > 0) {
      const requiredCommands = getMissingClueNames(session, missing);

      return {
        type: "warning",
        output: `FINAL MEMORY LOCKED. Recover these first: ${requiredCommands.join(", ")}.`,
      };
    }

    if (session.ending) {
      return {
        type: "system",
        output: `ENDING ALREADY SELECTED: ${session.ending.toUpperCase()}.`,
      };
    }

    return showEndingChoices();
  }

  const ending = story.ending.choices[normalized];

  if (ending) {
    if (session.ending) {
      return {
        type: "warning",
        output: "A final decision has already been made.",
      };
    }

    const missing = missingRequirements(
      session,
      ending.requires ?? []
    );

    if (missing.length > 0) {
      return {
        type: "warning",
        output:
          "THE PROCESS CANNOT YET BE RELEASED. Recover the hidden memory first.",
      };
    }

    await updateSession(sessionId, {
      status: "ENDED",
      ending: normalized,
      endedAt: new Date(),
    });

    session.ending = normalized;
    session.ended = true;

    return {
      type: "ending",
      endingId: normalized,
      title: ending.title,
      output: ending.message,
      storyComplete: true,
      sessionEnded: true,
    };
  }

  if (normalized === "whisper" || normalized.startsWith("ask ")) {
    const requestStartedAt = Date.now();
    const guardedResponse = getGuardedResponse(command, session);

    if (guardedResponse) {
      await waitForMinimumDelay(requestStartedAt);

      await persistConversation(
        session,
        sessionId,
        command,
        guardedResponse
      );

      return {
        type: "ghost",
        output: guardedResponse,
        cluesDiscovered: session.clues.length,
        totalClues: story.clues.length,
      };
    }

    // Ollama responses have no additional artificial delay.
    const answer = await generateGhostResponse({
      command,
      evidence: getEvidence(session),
      history: session.history.slice(-8),
    });

    await persistConversation(
      session,
      sessionId,
      command,
      answer
    );

    return {
      type: "ghost",
      output: answer,
      cluesDiscovered: session.clues.length,
      totalClues: story.clues.length,
    };
  }

  return {
    type: "error",
    output: `UNKNOWN COMMAND: ${command}\nType "help" to inspect available commands.`,
  };
}

export async function processCommand(command, sessionId) {
  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    return processCommandInternal(command, sessionId);
  }

  // Execute the deterministic story engine first.
  const result = await processCommandInternal(
    command,
    sessionId
  );

  // Terminal logging must not invalidate successful gameplay.
  try {
    await saveTerminalEvent(
      sessionId,
      "command",
      `user@haunted:~$ ${trimmedCommand}`
    );

    if (result.type === "clear") {
      await saveTerminalEvent(sessionId, "clear", "");
    } else if (result.output) {
      await saveTerminalEvent(
        sessionId,
        result.type || "system",
        result.output
      );
    }
  } catch (error) {
    console.error(
      "Terminal event persistence failed:",
      error
    );
  }

  return result;
}