
import { prisma } from "../lib/prisma.js";

export async function saveDiscoveredClue(sessionId, clueId) {
  return prisma.discoveredClue.upsert({
    where: {
      sessionId_clueId: {
        sessionId,
        clueId,
      },
    },
    update: {},
    create: {
      sessionId,
      clueId,
    },
  });
}

export async function getDiscoveredClueIds(sessionId) {
  const clues = await prisma.discoveredClue.findMany({
    where: { sessionId },
    orderBy: { id: "asc" },
    select: {
      clueId: true,
    },
  });

  return clues.map((clue) => clue.clueId);
}
