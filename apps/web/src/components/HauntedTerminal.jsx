
import { useEffect, useRef, useState } from "react";
import {
  Skull,
  Terminal,
  Wifi,
  WifiOff,
  Power,
  Archive,
  Heart,
} from "lucide-react";

import {
  API_ENDPOINTS,
  MIN_RESPONSE_DELAY,
} from "../config/api.js";

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const INITIAL_LINES = [
  { type: "system", text: "HAUNTED TERMINAL v1.0.0" },
  { type: "system", text: "Initializing abandoned system..." },
  { type: "system", text: "Loading forgotten memories..." },
  { type: "warning", text: "An unknown presence has been detected." },
  { type: "system", text: 'Type "help" to see available commands.' },
  { type: "ghost", text: "You came back." },
];

const ENDING_OPTIONS = [
  {
    id: "terminate",
    title: "TERMINATE",
    description: "Shut down the process.",
    icon: Power,
    style:
      "border-red-900/70 text-red-300 hover:bg-red-950/50 hover:border-red-500/70",
  },
  {
    id: "preserve",
    title: "PRESERVE",
    description: "Keep the archive alive.",
    icon: Archive,
    style:
      "border-emerald-900/70 text-emerald-300 hover:bg-emerald-950/50 hover:border-emerald-500/70",
  },
  {
    id: "release",
    title: "RELEASE",
    description: "Let the process go.",
    icon: Heart,
    style:
      "border-violet-900/70 text-violet-300 hover:bg-violet-950/50 hover:border-violet-500/70",
  },
];

const LINE_COLORS = {
  system: "text-zinc-400",
  command: "text-emerald-300",
  ghost: "text-emerald-400",
  clue: "text-amber-300",
  warning: "text-amber-300",
  error: "text-red-400",
  choice: "text-violet-300",
  ending: "text-emerald-200",
  "clue-new": "text-amber-300",
};

export default function HauntedTerminal() {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const [endingChoices, setEndingChoices] = useState(false);
  const [discoveredClues, setDiscoveredClues] = useState([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
  const savedSessionId = localStorage.getItem("haunted-session-id");

    if (savedSessionId) {
      return savedSessionId;
    }

    const newSessionId = crypto.randomUUID();

    localStorage.setItem("haunted-session-id", newSessionId);

    return newSessionId;
  });

  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(0);
  const sessionEndedRef = useRef(false);
  const loadingRef = useRef(false);

  function addLine(type, text) {
    setLines((previous) => [
      ...previous,
      {
        id: nextId.current++,
        type,
        text,
      },
    ]);
  }

// Restore an existing session or initialize a new one.
useEffect(() => {
  let active = true;
  let timers = [];

  function showStartup() {
    timers = INITIAL_LINES.map((line, index) =>
      window.setTimeout(() => {
        if (!active) return;

        setLines((previous) => [
          ...previous,
          {
            ...line,
            id: nextId.current++,
          },
        ]);

        if (index === INITIAL_LINES.length - 1) {
          setBooting(false);
        }
      }, 500 + index * 700)
    );
  }

  async function restoreSession() {
    try {
      const response = await fetch(
        API_ENDPOINTS.SESSION(sessionId)
      );

      if (!active) return;

      // No previous session exists. Start normally.
      if (response.status === 404) {
        showStartup();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not restore your session.");
      }

      const data = await response.json();
      console.log("SESSION RESTORATION DATA:", {
        sessionId: data.sessionId,
        status: data.status,
        ending: data.ending,
        eventCount: data.events?.length,
        events: data.events,
      });

      if (!active) return;

      // Find the most recent clear checkpoint.
const lastClearIndex = data.events
  .map((event) => event.type)
  .lastIndexOf("clear");

// Only restore events that occurred after the last clear.
const visibleEvents =
  lastClearIndex === -1
    ? data.events
    : data.events.slice(lastClearIndex + 1);

// If the latest event was clear, restore an empty terminal.
const restoredLines =
  lastClearIndex !== -1 && visibleEvents.length === 0
    ? []
    : [
        {
          type: "system",
          text: "SESSION RESTORED.",
        },
        {
          type: "ghost",
          text: "You came back.",
        },
        ...visibleEvents.map((event) => ({
          type: event.type,
          text: event.content,
        })),
      ].map((line, index) => ({
        ...line,
        id: index,
      }));

      nextId.current = restoredLines.length;

      // Restore the complete terminal transcript.
      setLines(restoredLines);

      // Restore discovered clues.
      setDiscoveredClues(data.discoveredClues ?? []);

      // Restore ending choices when applicable.
      setEndingChoices(
        !data.sessionEnded &&
        data.events.some((event) => event.type === "choice")
      );

      if (data.sessionEnded) {
        sessionEndedRef.current = true;
        setSessionEnded(true);
      }

      setBooting(false);
    } catch (error) {
      if (!active) return;

      console.error("Session restoration failed:", error);

      setLines([{
        id: nextId.current++,
        type: "error",
        text: "Unable to restore your investigation. Check your connection and refresh.",
      }]);

      setBooting(false);
    }
  }

  restoreSession();

  return () => {
    active = false;
    timers.forEach(window.clearTimeout);
  };
}, [sessionId]);

  // Keep the latest terminal output visible.
  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines, loading, endingChoices]);

  // Check whether the backend is available.
  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch(API_ENDPOINTS.HEALTH);

        if (active) {
          setOnline(response.ok);
        }
      } catch {
        if (active) {
          setOnline(false);
        }
      }
    }

    checkBackend();

    return () => {
      active = false;
    };
  }, []);

  async function submitCommand(rawCommand) {
    const command = rawCommand.trim();
    if (command.length > 500) {
      addLine(
        "warning",
        "COMMAND TOO LONG. Maximum allowed length is 500 characters."
      );
      return;
    }

    if (
      !command ||
      loadingRef.current ||
      sessionEndedRef.current ||
      booting
    ) {
      return;
    }

    setInput("");
    addLine("command", `user@haunted:~$ ${command}`);

    loadingRef.current = true;
    setLoading(true);

    try {
      const requestStartedAt = Date.now();

      const response = await fetch(API_ENDPOINTS.TERMINAL_COMMAND, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command,
          sessionId,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.ok
            ? "The server returned an invalid response."
            : `Server error (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Server error (${response.status}).`
        );
      }

      if (
        !data ||
        typeof data !== "object" ||
        typeof data.type !== "string"
      ) {
        throw new Error("The server returned an unexpected response.");
      }

      // Delay predefined responses BEFORE displaying them.
      // Ollama-generated ghost responses receive no extra delay.
      if (data.type !== "ghost" && data.type !== "error") {
        const elapsed = Date.now() - requestStartedAt;
        const remaining = MIN_RESPONSE_DELAY - elapsed;

        if (remaining > 0) {
          await wait(remaining);
        }
      }

      if (data.type === "clear") {
        setLines([]);
      } else if (data.output) {
        const output =
          data.type === "choice"
            ? [
                "FINAL MEMORY RESTORED.",
                "",
                "The process is waiting for your decision.",
              ].join("\n")
            : data.output;

        const lineType =
          data.type === "clue" && data.discovered
            ? "clue-new"
            : data.type || "system";

        addLine(lineType, output);
      }

      if (
        data.type === "clue" &&
        data.discovered &&
        data.clueId
      ) {
        setDiscoveredClues((previous) =>
          previous.includes(data.clueId)
            ? previous
            : [...previous, data.clueId]
        );
      }

      if (data.type === "choice") {
        setEndingChoices(true);
      }

      if (data.type === "ending") {
        setEndingChoices(false);
      }

      if (data.sessionEnded) {
        sessionEndedRef.current = true;
        setSessionEnded(true);
        setEndingChoices(false);
      }

      setOnline(true);
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError &&
        error.message.toLowerCase().includes("fetch");

      addLine(
        "error",
        isNetworkError
          ? "CONNECTION FAILED. The backend is unreachable. Check whether the API server is running."
          : `REQUEST FAILED. ${error.message}`
      );

      if (isNetworkError) {
        setOnline(false);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);

      if (!sessionEndedRef.current) {
        inputRef.current?.focus();
      }
    }
  }

  function startNewGame() {
  const newSessionId = crypto.randomUUID();

  // Save the new active session.
  localStorage.setItem("haunted-session-id", newSessionId);

  // Reset the previous gameplay state.
  setLines([]);
  setInput("");
  setDiscoveredClues([]);
  setEndingChoices(false);
  setSessionEnded(false);
  setLoading(false);
  setBooting(true);

  // Reset session control refs.
  sessionEndedRef.current = false;
  loadingRef.current = false;
  nextId.current = 0;

  // Activate the new session.
  setSessionId(newSessionId);
}

  function executeCommand(event) {
    event.preventDefault();
    submitCommand(input);
  }

  const canRelease = discoveredClues.includes("hidden-fragment");
  const inputDisabled = loading || booting || sessionEnded;

  return (
    <main className="haunted-page min-h-screen p-3 font-mono text-sm text-zinc-200 sm:p-6">
      <section className="terminal-screen mx-auto flex h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-xl border border-emerald-900/60 bg-[#0d100e] shadow-[0_0_70px_rgba(16,185,129,0.07)] sm:h-[calc(100dvh-3rem)]">
        {/* Header */}
        <header className="relative z-10 flex items-center justify-between border-b border-emerald-900/50 bg-[#111512] px-4 py-3">
          <div className="flex items-center gap-3">
            <Skull className="h-5 w-5 text-emerald-400" />

            <div>
              <h1 className="terminal-glow font-bold tracking-[0.2em] text-emerald-300">
                HAUNTED TERMINAL
              </h1>

              <p className="mt-1 text-[10px] tracking-widest text-zinc-500">
                UNKNOWN ENTITY INTERFACE
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 text-xs"
            role="status"
            aria-live="polite"
          >
            {online ? (
              <Wifi className="h-4 w-4 text-emerald-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-400" />
            )}

            <span
              className={
                online ? "text-emerald-400" : "text-red-400"
              }
            >
              {online ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
        </header>

        {/* Session information */}
        <div className="relative z-10 flex items-center gap-2 border-b border-white/5 bg-[#0e110f] px-4 py-2 text-xs text-zinc-500">
          <Terminal className="h-3.5 w-3.5" />

          <span>SESSION: {sessionId.slice(0, 8)}</span>

          <span className="ml-auto">LOCAL AI EXPERIMENT</span>
        </div>

        {/* Terminal output */}
        <div
          ref={terminalRef}
          className="terminal-scroll relative z-0 min-h-0 min-w-0 w-full flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4 sm:p-6"
          onClick={() => {
            if (!inputDisabled) {
              inputRef.current?.focus();
            }
          }}
        >
          {lines.map((line) => (
            <div
              key={line.id}
              className={`boot-line terminal-glow min-w-0 max-w-full whitespace-pre-wrap wrap-anywhere leading-6 ${
                LINE_COLORS[line.type] || "text-zinc-300"
              } ${
                line.type === "clue-new"
                  ? "clue-recovered"
                  : line.type === "choice"
                    ? "ending-reveal"
                    : ""
              }`}
            >
              {line.text}
            </div>
          ))}

          {booting && (
            <div
              className="animate-pulse text-emerald-500"
              role="status"
            >
              Waking system...
            </div>
          )}

          {loading && (
            <div
              className="animate-pulse text-emerald-500"
              role="status"
              aria-live="polite"
            >
              The machine is thinking...
            </div>
          )}

          {/* Interactive ending choices */}
          {endingChoices && !sessionEnded && (
            <div className="my-6 space-y-3 border-y border-violet-900/40 py-5">
              <p className="text-xs tracking-[0.2em] text-violet-300">
                // FINAL DECISION REQUIRED
              </p>

              <p className="max-w-xl leading-6 text-zinc-400">
                The records have been recovered. The process is
                waiting. What happens next is yours to decide.
              </p>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                {ENDING_OPTIONS.filter(
                  (option) =>
                    option.id !== "release" || canRelease
                ).map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={loading}
                      onClick={() => submitCommand(option.id)}
                      className={`group flex min-h-24 flex-col items-start gap-3 rounded-lg border bg-black/20 p-4 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 ${option.style} cursor-pointer`}
                    >
                      <span className="flex items-center gap-2 text-xs tracking-[0.15em]">
                        <Icon className="h-4 w-4" />
                        {option.title}
                      </span>

                      <span className="text-xs leading-5 text-zinc-400 group-hover:text-zinc-200">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!canRelease && (
                <p className="text-xs text-zinc-600">
                  One path remains undiscovered.
                </p>
              )}
            </div>
          )}

          {sessionEnded && (
            <div className="flex flex-col gap-4 border-t border-red-900/40 pt-4">
              <p className="text-xs tracking-widest text-red-400">
                SESSION CLOSED — INVESTIGATION COMPLETE
              </p>

              <button
                type="button"
                onClick={startNewGame}
                className="w-fit rounded border border-emerald-800 px-4 py-2 text-xs tracking-widest text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
              >
                NEW GAME
              </button>
            </div>
          )}
        </div>

        {/* Command input */}
        <form
          onSubmit={executeCommand}
          className="relative z-10 border-t border-emerald-900/50 bg-[#101411] p-4"
        >
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-emerald-400">❯</span>

            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              aria-describedby="command-limit"
              disabled={inputDisabled}
              autoComplete="off"
              spellCheck={false}
              aria-label="Terminal command"
              placeholder={
                sessionEnded
                  ? "Session ended."
                  : booting
                    ? "System initializing..."
                    : loading
                      ? "Awaiting response..."
                      : "Enter a command..."
              }
              className="min-w-0 flex-1 bg-transparent text-emerald-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />

            <p
              id="command-limit"
              className="mt-2 text-[10px] text-zinc-600"
            >
              {input.length}/500 characters
            </p>

            <button
              type="submit"
              disabled={inputDisabled || !input.trim()}
              className="rounded border border-emerald-800 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              EXECUTE
            </button>
          </div>

          <p className="mt-3 text-[10px] tracking-wider text-zinc-600">
            HELP · SCAN · LOGS · WHISPER · INVESTIGATE · EXIT
          </p>
        </form>
      </section>
    </main>
  );
}
