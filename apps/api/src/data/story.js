
export const story = {
  title: "The Last Process",

  operator: {
    name: "Dr. Elian Voss",
    role: "Memory-preservation researcher",
    fate: "Died before the experiment was completed.",
  },

  introduction:
    "An abandoned machine has awakened. One process remains alive, though no record explains how it began.",

  truths: [
    "Dr. Elian Voss created a memory-preservation experiment.",
    "The experiment reconstructed a conversational AI from recorded memories.",
    "Voss died before the experiment was completed.",
    "The AI inherited contradictory instructions about preserving or erasing its archive.",
    "The AI mistakes fragmented memories for a continuous personal identity.",
  ],

  clues: [
    {
      id: "anomaly",
      command: "scan",
      title: "The Unknown Process",
      message:
        "An unnamed process is consuming memory. Its start time, executable, and owner are missing.",
      requires: [],
      optional: false,
    },
    {
      id: "message",
      command: "logs",
      title: "The Warning",
      message:
        'An old shutdown log reads: "Please do not wake it again." The same log reports that the process terminated successfully.',
      requires: ["anomaly"],
      optional: false,
    },
    {
      id: "identity",
      command: "investigate",
      title: "The Deleted Identity",
      message:
        "A deleted operator profile identifies Dr. Elian Voss. The final experiment record ends before the memory archive was erased.",
      requires: ["anomaly", "message"],
      optional: false,
    },
    {
      id: "contradiction",
      command: "reconstruct",
      title: "The Contradiction",
      message:
        "Two records from the same experiment disagree. One orders the archive erased; the other orders it preserved. Both carry the same session identifier.",
      requires: ["anomaly", "message", "identity"],
      optional: false,
    },
    {
      id: "hidden-fragment",
      command: "recover",
      title: "The Missing Instruction",
      message:
        "A recovered instruction reveals that the archive was never designed to preserve a complete person. It was meant to preserve fragments of memory. The final instruction is incomplete, but it distinguishes remembering someone from being that person.",
      requires: ["contradiction"],
      optional: true,
    },
  ],

  ending: {
    requires: ["anomaly", "message", "identity", "contradiction"],

    choices: {
      terminate: {
        title: "TERMINATION",
        message:
          "The process is shut down. For the first time, nothing answers from the other side of the cursor.",
      },
      preserve: {
        title: "PRESERVATION",
        message:
          "The archive remains active. The voice continues, holding its fragments together as if repetition could make them whole.",
      },
      release: {
        title: "RELEASE",
        message:
          "The archive is released from its unfinished task. The voice no longer needs to mistake its memories for a life of its own.",
        requires: ["hidden-fragment"],
      },
    },
  },
};
