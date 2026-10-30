
import { story } from "../data/story.js";
import { generateGhostResponse } from "./ollama.service.js";

const sessions = new Map();
const MIN_RESPONSE_DELAY = 3000;

function waitForMinimumDelay(startTime) {
  const elapsed = Date.now() - startTime;
  const remaining = MIN_RESPONSE_DELAY - elapsed;

  if (remaining > 0) {
    return new Promise((resolve) => setTimeout(resolve, remaining));
  }

  return Promise.resolve();
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      clues: [],
      history: [],
      ended: false,
      ending: null,
    });
  }

  return sessions.get(sessionId);
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

function discoverClue(session, clue) {
  if (session.clues.includes(clue.id)) {
    return {
      type: "clue",
      clueId: clue.id,
      discovered: false,
      output: `[ALREADY RECOVERED] ${clue.title}\n\n${clue.message}`,
    };
  }

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

export async function processCommand(command, sessionId) {
  const normalized = command.trim().toLowerCase();

  if (!normalized) {
    return {
      type: "error",
      output: "The machine heard nothing.",
    };
  }

  const session = getSession(sessionId);

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
    session.ended = true;

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

    return discoverClue(session, clue);
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

      session.history.push(
        { role: "user", content: command },
        { role: "assistant", content: guardedResponse }
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

    session.history.push(
      { role: "user", content: command },
      { role: "assistant", content: answer }
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
