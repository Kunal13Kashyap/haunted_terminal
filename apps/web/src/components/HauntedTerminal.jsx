import { useEffect, useRef, useState } from "react";
import {
  Skull,
  Terminal,
  Wifi,
  WifiOff,
  Power,
  Archive,
  Heart,
  AlertTriangle,
  Activity,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  API_ENDPOINTS,
  MIN_RESPONSE_DELAY,
} from "../config/api.js";

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const INITIAL_LINES = [
  { type: "system", text: "INFRASTRUCTURE #674" },
  { type: "system", text: "Initializing abandoned system..." },
  { type: "system", text: "Loading forgotten memories..." },
  { type: "warning", text: "UNAUTHORIZED ACCESS DETECTED." },
  { type: "ghost", text: "Entity is already inside." },
  { type: "system", text: 'Type "help" to see available commands.' },
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
  warning: "text-red-400",
  error: "text-red-400",
  choice: "text-violet-300",
  ending: "text-emerald-200",
  "clue-new": "text-amber-300",
};

const KEYBOARD_ROWS = [
  ["ESC", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "DEL"],
  ["TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "↵"],
  ["CTRL", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "↵"],
  ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "SHIFT"],
];

function getKeyboardKey(key) {
  const specialKeys = {
    Escape: "ESC",
    Backspace: "DEL",
    Delete: "DEL",
    Tab: "TAB",
    Control: "CTRL",
    Shift: "SHIFT",
    Enter: "↵",
    " ": "SPACE",
  };

  if (specialKeys[key]) {
    return specialKeys[key];
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return null;
}

function animateAudioVolume(
  mainAudio,
  secondaryAudio,
  targetMain,
  targetSecondary,
  duration,
  frameRef,
  onComplete
) {
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current);
  }

  const startMain = mainAudio.volume;
  const startSecondary = secondaryAudio.volume;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const easedProgress = progress * progress * (3 - 2 * progress);

    mainAudio.volume =
      startMain + (targetMain - startMain) * easedProgress;

    secondaryAudio.volume =
      startSecondary + (targetSecondary - startSecondary) * easedProgress;

    if (progress < 1) {
      frameRef.current = window.requestAnimationFrame(step);
      return;
    }

    frameRef.current = null;
    onComplete?.();
  }

  frameRef.current = window.requestAnimationFrame(step);
}

export default function HauntedTerminal() {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const [endingChoices, setEndingChoices] = useState(false);
  const [discoveredClues, setDiscoveredClues] = useState([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

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
  const mainAudioRef = useRef(null);
  const secondaryAudioRef = useRef(null);
  const audioFadeFrameRef = useRef(null);

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

  // Load the actual horror ambience recordings.
  useEffect(() => {
    const mainAudio = new Audio(
      "/audio/universfield-horror-background-atmosphere-156462.mp3"
    );

    const secondaryAudio = new Audio(
      "/audio/horror-ambience-dark-80.mp3"
    );

    mainAudio.loop = true;
    secondaryAudio.loop = true;

    mainAudio.preload = "auto";
    secondaryAudio.preload = "auto";

    mainAudio.volume = 0;
    secondaryAudio.volume = 0;

    mainAudioRef.current = mainAudio;
    secondaryAudioRef.current = secondaryAudio;

    return () => {
      if (audioFadeFrameRef.current !== null) {
        window.cancelAnimationFrame(audioFadeFrameRef.current);
      }

      mainAudio.pause();
      secondaryAudio.pause();

      mainAudio.removeAttribute("src");
      secondaryAudio.removeAttribute("src");

      mainAudio.load();
      secondaryAudio.load();

      mainAudioRef.current = null;
      secondaryAudioRef.current = null;
    };
  }, []);

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
        }, 450 + index * 650)
      );
    }

    async function restoreSession() {
      try {
        const response = await fetch(
          API_ENDPOINTS.SESSION(sessionId)
        );

        if (!active) return;

        if (response.status === 404) {
          showStartup();
          return;
        }

        if (!response.ok) {
          throw new Error("Could not restore your session.");
        }

        const data = await response.json();

        if (!active) return;

        const events = data.events ?? [];

        const lastClearIndex = events
          .map((event) => event.type)
          .lastIndexOf("clear");

        const visibleEvents =
          lastClearIndex === -1
            ? events
            : events.slice(lastClearIndex + 1);

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

        setLines(restoredLines);
        setDiscoveredClues(data.discoveredClues ?? []);

        setEndingChoices(
          !data.sessionEnded &&
          events.some((event) => event.type === "choice")
        );

        if (data.sessionEnded) {
          sessionEndedRef.current = true;
          setSessionEnded(true);
        }

        setBooting(false);
      } catch (error) {
        if (!active) return;

        console.error("Session restoration failed:", error);

        setLines([
          {
            id: nextId.current++,
            type: "error",
            text:
              "Unable to restore your investigation. Check your connection and refresh.",
          },
        ]);

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

  // Check backend availability.
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

  // Track physical keyboard presses while the terminal input is focused.
  function handleKeyDown(event) {
    const key = getKeyboardKey(event.key);

    if (!key) return;

    setPressedKeys((previous) => {
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  }

  function handleKeyUp(event) {
    const key = getKeyboardKey(event.key);

    if (!key) return;

    setPressedKeys((previous) => {
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
  }

  function clearPressedKeys() {
    setPressedKeys(new Set());
  }

async function toggleAmbientAudio() {
  const mainAudio = mainAudioRef.current;
  const secondaryAudio = secondaryAudioRef.current;

  if (!mainAudio || !secondaryAudio) {
    addLine("warning", "AUDIO SYSTEM IS NOT READY. TRY AGAIN.");
    return;
  }

  // Turn ambience off.
  if (audioEnabled) {
    setAudioEnabled(false);

    animateAudioVolume(
      mainAudio,
      secondaryAudio,
      0,
      0,
      900,
      audioFadeFrameRef,
      () => {
        mainAudio.pause();
        secondaryAudio.pause();
      }
    );

    return;
  }

  // Start playback after explicit visitor interaction.
  mainAudio.volume = 0;
  secondaryAudio.volume = 0;

  try {
    const results = await Promise.allSettled([
      mainAudio.play(),
      secondaryAudio.play(),
    ]);

    // Main ambience is essential.
    if (results[0].status === "rejected") {
      mainAudio.pause();
      secondaryAudio.pause();
      throw results[0].reason;
    }

    // Secondary ambience is optional.
    if (results[1].status === "rejected") {
      secondaryAudio.pause();

      addLine(
        "warning",
        "SECONDARY AMBIENCE UNAVAILABLE. PRIMARY AUDIO CONTINUES."
      );
    }

    setAudioEnabled(true);

    animateAudioVolume(
      mainAudio,
      secondaryAudio,
      0.42,
      results[1].status === "fulfilled" ? 0.16 : 0,
      1800,
      audioFadeFrameRef
    );
  } catch (error) {
    console.error("Audio playback failed:", error);

    mainAudio.pause();
    secondaryAudio.pause();

    mainAudio.volume = 0;
    secondaryAudio.volume = 0;

    setAudioEnabled(false);

    addLine(
      "warning",
      "AUDIO PLAYBACK FAILED. CHECK THE FILES IN public/audio."
    );
  }
}

  // Release audio resources if the terminal is unmounted.
  useEffect(() => {
  return () => {
    if (audioFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFadeFrameRef.current);
      audioFadeFrameRef.current = null;
    }

    mainAudioRef.current?.pause();
    secondaryAudioRef.current?.pause();
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
    addLine("command", `user@infrastructure:~$ ${command}`);

    loadingRef.current = true;
    setLoading(true);

    try {
      const requestStartedAt = Date.now();

      const response = await fetch(
        API_ENDPOINTS.TERMINAL_COMMAND,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command,
            sessionId,
          }),
        }
      );

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
        throw new Error(
          "The server returned an unexpected response."
        );
      }

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

    localStorage.setItem("haunted-session-id", newSessionId);

    setLines([]);
    setInput("");
    setPressedKeys(new Set());
    setDiscoveredClues([]);
    setEndingChoices(false);
    setSessionEnded(false);
    setLoading(false);
    setBooting(true);

    sessionEndedRef.current = false;
    loadingRef.current = false;
    nextId.current = 0;

    setSessionId(newSessionId);
  }

  function executeCommand(event) {
    event.preventDefault();
    submitCommand(input);
  }

  const canRelease = discoveredClues.includes("hidden-fragment");
  const inputDisabled = loading || booting || sessionEnded;

  return (
    <main className="haunted-page font-mono text-sm">
      <section className="workstation">

        {/* Physical CRT monitor */}
        <div className="crt-shell">
          <div className="crt-screen">

            <div className="crt-entity-glow" />

            {/* The entity stays fixed to the CRT, outside the scrolling transcript. */}
            <div className="entity-eyes" aria-hidden="true">
              <span className="entity-eye" />
              <span className="entity-eye" />
            </div>

            <div className="crt-glass" />

            <div className="crt-content flex flex-col">

              {/* Monitor header */}
              <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/50 pb-4">

                <div className="flex items-center gap-3">
                  <Skull className="h-6 w-6 text-emerald-400" />

                  <div>
                    <h1 className="phosphor-glow text-sm font-bold tracking-[0.24em] sm:text-base">
                      INFRASTRUCTURE #674
                    </h1>

                    <p className="mt-1 text-[9px] tracking-[0.2em] text-zinc-500">
                      UNKNOWN ENTITY INTERFACE
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div
                    className="flex items-center gap-2 text-[10px] tracking-widest"
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
                        online
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {online ? "CONNECTED" : "OFFLINE"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAmbientAudio}
                    className="audio-toggle"
                    aria-label={
                      audioEnabled
                        ? "Turn ambient sound off"
                        : "Turn ambient sound on"
                    }
                    aria-pressed={audioEnabled}
                    title={
                      audioEnabled
                        ? "Disable ambient sound"
                        : "Enable ambient sound"
                    }
                  >
                    {audioEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                    {audioEnabled ? "AUDIO ON" : "ENABLE AUDIO"}
                  </button>
                </div>
              </header>

              {/* System status strip */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-3 text-[10px] tracking-wider text-zinc-500">

                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>SESSION: {sessionId.slice(0, 8)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald-700" />
                  <span>LOCAL AI EXPERIMENT</span>
                </div>
              </div>

              {/* Main terminal area */}
              <div
                ref={terminalRef}
                className="terminal-scroll relative z-2 min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto py-6"
                onClick={() => {
                  if (!inputDisabled) {
                    inputRef.current?.focus();
                  }
                }}
              >

                {/* Initial system identity */}
                <div className="mb-7 text-center">
                  <p className="phosphor-glow text-lg font-bold tracking-[0.12em] sm:text-2xl">
                    INFRASTRUCTURE
                  </p>

                  <p className="phosphor-glow text-4xl font-black tracking-widest sm:text-6xl">
                    #674
                  </p>

                  <div className="danger-glow mx-auto mt-3 w-fit border-y border-red-900/70 px-6 py-2 text-xs font-bold tracking-[0.18em] sm:text-sm">
                    UNAUTHORIZED ACCESS
                  </div>

                  <p className="mt-3 text-[11px] text-emerald-400">
                    Entity is already inside.
                  </p>
                </div>

                {/* Investigation logs */}
                <div className="mb-5 border-y border-emerald-900/40 bg-black/30 px-3 py-3 text-[9px] leading-5 text-zinc-500 sm:text-[10px]">

                  <div className="flex items-center justify-between gap-3">
                    <span>/dev/memory_leak</span>
                    <span className="text-red-400">
                      DETECTED
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>process: observer_daemon</span>
                    <span className="text-emerald-600">
                      PERSISTENT
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>status: investigation</span>
                    <span className="text-emerald-600">
                      ACTIVE
                    </span>
                  </div>
                </div>

                {/* Dynamic terminal transcript */}
                <div className="space-y-3">
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
                </div>

                {booting && (
                  <div
                    className="animate-pulse text-xs text-emerald-400"
                    role="status"
                  >
                    INITIALIZING SYSTEM...
                  </div>
                )}

                {loading && (
                  <div
                    className="animate-pulse text-xs text-emerald-400"
                    role="status"
                    aria-live="polite"
                  >
                    THE MACHINE IS THINKING...
                  </div>
                )}

                {/* Ending choices */}
                {endingChoices && !sessionEnded && (
                  <div className="my-7 space-y-4 border-y border-violet-900/50 bg-violet-950/5 py-5">

                    <p className="text-xs tracking-[0.2em] text-violet-300">
                      // FINAL DECISION REQUIRED
                    </p>

                    <p className="max-w-xl text-xs leading-6 text-zinc-400">
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
                            className={`group flex min-h-24 cursor-pointer flex-col items-start gap-3 rounded-sm border bg-black/40 p-4 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 ${option.style}`}
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
                      <p className="text-[10px] text-zinc-600">
                        ONE PATH REMAINS UNDISCOVERED.
                      </p>
                    )}
                  </div>
                )}

                {/* End of investigation */}
                {sessionEnded && (
                  <div className="flex flex-col gap-4 border-t border-red-900/50 pt-5">

                    <p className="danger-glow text-xs tracking-[0.15em]">
                      SESSION CLOSED — INVESTIGATION COMPLETE
                    </p>

                    <button
                      type="button"
                      onClick={startNewGame}
                      className="w-fit cursor-pointer border border-emerald-800 px-5 py-2 text-xs tracking-widest text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      REBOOT SYSTEM
                    </button>
                  </div>
                )}

              </div>

              {/* Command input */}
              <form
                onSubmit={executeCommand}
                className="relative z-10 mt-3 border-t border-emerald-900/60 pt-4"
              >

                <div className="flex min-w-0 items-center gap-3">

                  <span className="phosphor-glow shrink-0 text-lg">
                    ❯
                  </span>

                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) =>
                      setInput(event.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    onBlur={clearPressedKeys}
                    maxLength={500}
                    aria-describedby="command-limit"
                    disabled={inputDisabled}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Terminal command"
                    placeholder={
                      sessionEnded
                        ? "Investigation complete."
                        : booting
                          ? "System initializing..."
                          : loading
                            ? "Awaiting response..."
                            : "Enter a command..."
                    }
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-emerald-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
                  />

                  <button
                    type="submit"
                    disabled={inputDisabled || !input.trim()}
                    className="shrink-0 cursor-pointer border border-emerald-800/80 px-3 py-2 text-[10px] tracking-widest text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    EXECUTE
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-[9px] text-zinc-600">
                  <span id="command-limit">
                    {input.length}/500 CHARACTERS
                  </span>

                  <span>
                    HELP · SCAN · LOGS · WHISPER · INVESTIGATE · EXIT
                  </span>
                </div>
              </form>

            </div>
          </div>
        </div>

        {/* Physical keyboard */}
        <div className="physical-keyboard">

          <div className="mb-3 flex items-center justify-between text-[8px] tracking-[0.25em] text-zinc-600">
            <span>INFRASTRUCTURE INPUT DEVICE</span>
            <span className="danger-glow">674</span>
          </div>

          <div className="keyboard-keys">
            {KEYBOARD_ROWS.flat().map((key, index) => (
              <div
                key={`${key}-${index}`}
                className={`keyboard-key ${
                  pressedKeys.has(key) ? "is-pressed" : ""
                }`}
              >
                {key}
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-center">
            <div
              className={`h-4 w-[42%] rounded border border-zinc-700 bg-linear-to-b from-zinc-800 to-zinc-950 shadow-[0_3px_0_#030504] transition-all duration-75 ${
                pressedKeys.has("SPACE")
                  ? "translate-y-0.75 border-emerald-400 bg-emerald-950 shadow-none"
                  : ""
              }`}
            />
          </div>
        </div>

        {/* Workstation footer */}
        <div className="mt-4 flex w-full items-center justify-between px-3 text-[8px] tracking-[0.2em] text-zinc-700">
          <span>SYS.674 // MEMORY ARCHIVE</span>

          <span className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-red-900" />
            DO NOT DISCONNECT
          </span>
        </div>

      </section>
    </main>
  );
}
