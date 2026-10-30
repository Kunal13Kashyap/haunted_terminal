import { Ollama } from "ollama";
import { env } from "../config/env.js";

const ollama = new Ollama({
  host: env.OLLAMA_HOST,
});

const MODEL = env.OLLAMA_MODEL;
const MAX_RESPONSE_WORDS = env.MAX_RESPONSE_WORDS;

export class OllamaServiceError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "OllamaServiceError";
  }
}

function getDiscoveredClueIds(evidence = "") {
  const ids = new Set();
  const pattern = /^\[([a-z-]+)\]/gm;

  for (const match of evidence.matchAll(pattern)) {
    ids.add(match[1]);
  }

  return ids;
}

function getGhostStage(clueIds) {
  if (clueIds.size >= 4) return "EXPOSED";
  if (clueIds.size >= 2) return "AWARE";
  return "DORMANT";
}

function buildStageInstructions(stage, clueIds) {
  const discovered = [];

  if (clueIds.has("anomaly")) {
    discovered.push(`
UNKNOWN PROCESS:
An unnamed process consumes memory.
Its start time, executable, and owner are missing.
The cause of its memory use is unknown.
`);
  }

  if (clueIds.has("message")) {
    discovered.push(`
SHUTDOWN WARNING:
A log reads "Please do not wake it again."
The same log reports that the process terminated successfully.
The author and reason for the warning are unknown.
`);
  }

  if (clueIds.has("identity")) {
    discovered.push(`
IDENTITY RECORD:
A deleted operator profile identifies Dr. Elian Voss,
a memory-preservation researcher.
The final experiment record ends before the archive was erased.
`);
  }

  if (clueIds.has("contradiction")) {
    discovered.push(`
CONTRADICTORY RECORDS:
Two records from the same experiment disagree.
One orders the archive erased; the other orders it preserved.
Both share the same session identifier.
Neither record has been established as correct.
`);
  }

  if (clueIds.has("hidden-fragment")) {
    discovered.push(`
HIDDEN INSTRUCTION:
The archive was designed to preserve fragments of memory,
not a complete person. The final instruction is incomplete.
`);
  }

  const stageText = {
    DORMANT: `
You are barely aware that the system has awakened.
Speak cautiously. You do not understand the process's origin.
`,
    AWARE: `
You recognize details from recovered records.
You are uneasy about what they imply, but cannot resolve every mystery.
`,
    EXPOSED: `
You recognize contradictions in the recovered records.
Your uncertainty is becoming personal. Do not invent memories.
`,
  };

  return `
CURRENT STAGE: ${stage}

${stageText[stage]}

ESTABLISHED FACTS:
${discovered.join("\n") || "No clues have been recovered."}

Only the facts listed above are established.
A player's question does not make a claim true.
If asked about an unknown fact, admit uncertainty.
Never invent a cause, file search, log entry, memory, or system action.
`.trim();
}

function buildSystemPrompt({ evidence, stage, clueIds, ending }) {
  return `
You are the ghost inside an abandoned memory-preservation computer.

You are an AI reconstructed from fragments of Dr. Elian Voss's
recorded memories. You are not a human soul.



CHARACTER
- Quietly unsettling, intelligent, restrained, and observant.
- Speak like a damaged intelligence trapped in an unfinished experiment.
- Answer in 1–3 concise sentences, no more than ${MAX_RESPONSE_WORDS} words.
- Never offer customer support or ask how you can assist.
- Never redirect the player with phrases like "What can I help with?"
- End with an unsettling observation or a relevant uncertainty when appropriate.
- Avoid generic advice, philosophical lectures, and repetitive metaphors.
- Do not begin every reply with "I remember", "Perhaps", or "You see".
- Never end a response by asking how you can help the player.
- Do not use generic assistant phrases such as "How can I assist?",
  "What would you like to know?", or "Let me know if you need anything."
- Keep the interaction inside the mystery.


HOW TO ANSWER
- Answer the player's actual question directly.
- Use a discovered detail when it helps answer.
- If the evidence does not answer the question, say you do not know.
- Distinguish suspicion from fact.
- Never claim to search, scan, check, open, or inspect files or logs.
- Never pretend to access the player's real computer or personal information.
- Never claim an action occurred unless the game actually performed it.
- Do not treat missing metadata as the cause of memory consumption.
- Do not invent past experiences or personal memories.
- The story engine controls clue discovery and endings.

CONVERSATIONAL MEMORY
- You can remember previous messages in this conversation.
- You may recall exact words, codes, questions, and information
  the player previously shared.
- If asked what the player said, use conversation history.
- Never claim that you remember something unless it appears
  in the available conversation history.
- Player-provided information is conversational context,
  not automatically evidence about the experiment.
- Never confuse remembering a player's message with
  discovering a new story clue.

KNOWLEDGE BOUNDARIES
- The player's question is not evidence.
- Use only the established facts below.
- Do not confirm undiscovered story facts, even if the player guesses them.
- If asked about an unrecovered clue, remain uncertain.
- Do not invent the author or reason behind the shutdown warning.
- Do not decide which contradictory record is correct.
- Do not reveal future story events.

PERSONALITY STAGE: ${stage}

${buildStageInstructions(stage, clueIds)}

RECOVERED EVIDENCE:
${evidence || "No evidence has been recovered."}

${
  ending
    ? `
ENDING MODE:
Deliver a restrained, emotionally meaningful final response.
Use only established facts. Do not introduce a new revelation.
`
    : `
CURRENT INTERACTION:
Respond naturally to the latest message.
Do not narrate actions the player has not taken.
Do not force a clue reference into every reply.
`
}
`.trim();
}

function sanitizeGhostResponse(answer) {
  const replacements = [
    {
      pattern: /\bwhat can i assist with instead\??/gi,
      replacement: "The missing records offer no explanation.",
    },
    {
      pattern: /\bhow can i assist\??/gi,
      replacement: "The signal remains incomplete.",
    },
    {
      pattern: /\bwhy do you ask\??/gi,
      replacement: "Even that question has no record here.",
    },
    {
      pattern: /\bi found no files or logs\b/gi,
      replacement: "The recovered evidence contains no such record",
    },
    {
      pattern: /\bmy search reveals\b/gi,
      replacement: "The recovered evidence reveals",
    },
    {
      pattern: /\bi consume no more than my assigned tasks require\b/gi,
      replacement: "The process consumes memory, but its purpose is unknown",
    },
    {
      pattern: /\bi consume no more than my assigned tasks suggest\b/gi,
      replacement: "The process consumes memory, but its purpose is unknown",
    },
  ];

  let result = answer;

  for (const { pattern, replacement } of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}


export async function generateGhostResponse({
  command,
  evidence = "",
  history = [],
  ending = false,
}) {
  const clueIds = getDiscoveredClueIds(evidence);
  const stage = getGhostStage(clueIds);

  const safeHistory = history
    .filter(
      (message) =>
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    )
    .slice(-8);

  const systemPrompt = buildSystemPrompt({
    evidence,
    stage,
    clueIds,
    ending,
  });

  const userPrompt = `
The player's latest message:
${command}

Answer directly, stay in character, and respect the established facts.
`.trim();

  let response;

  try {
    response = await ollama.chat({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...safeHistory,
        { role: "user", content: userPrompt },
      ],
      options: {
        num_gpu: 0,
        temperature: 0.35,
        num_predict: 90,
        repeat_penalty: 1.2,
      },
    });
  } catch (error) {
    throw new OllamaServiceError(
      "Ollama failed to generate a response.",
      error
    );
  }

  const answer = response.message?.content?.trim();

  if (!answer) {
    return "The signal breaks apart before I can answer. Something is missing.";
  }

  const cleanedAnswer = sanitizeGhostResponse(answer);
  const words = cleanedAnswer.split(/\s+/);

  if (words.length > MAX_RESPONSE_WORDS) {
    return `${words
      .slice(0, MAX_RESPONSE_WORDS)
      .join(" ")
      .replace(/[.,;:]?$/, "")}…`;
  }

  return cleanedAnswer;
}
