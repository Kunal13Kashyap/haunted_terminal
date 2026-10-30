
import { prisma } from "../lib/prisma.js";

export async function getOrCreateSession(sessionId) {
  return prisma.session.upsert({
    where: {
      id: sessionId,
    },
    update: {},
    create: {
      id: sessionId,
    },
  });
}

export async function updateSession(sessionId, updates) {
  return prisma.session.update({
    where: {
      id: sessionId,
    },
    data: updates,
  });
}

export async function getSessionById(sessionId) {
  return prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      id: true,
      status: true,
      ending: true,
      clues: {
        select: {
          clueId: true,
        },
      },
    },
  });
}
