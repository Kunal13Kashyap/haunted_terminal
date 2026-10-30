import { prisma } from "../lib/prisma.js";

export async function saveTerminalEvent(sessionId, type, content) {
  return prisma.terminalEvent.create({
    data: {
      sessionId,
      type,
      content,
    },
  });
}

export async function getTerminalEvents(sessionId) {
  return prisma.terminalEvent.findMany({
    where: { sessionId },
    orderBy: { id: "asc" },
    select: {
      type: true,
      content: true,
      createdAt: true,
    },
  });
}