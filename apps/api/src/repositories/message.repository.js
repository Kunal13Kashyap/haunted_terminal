
import { prisma } from "../lib/prisma.js";

export async function saveConversationTurn(
  sessionId,
  userMessage,
  assistantMessage
) {
  return prisma.$transaction(async (tx) => {
    await tx.conversationMessage.create({
      data: {
        sessionId,
        role: "user",
        content: userMessage,
      },
    });

    await tx.conversationMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: assistantMessage,
      },
    });
  });
}

export async function getRecentMessages(sessionId, limit = 8) {
  const messages = await prisma.conversationMessage.findMany({
    where: { sessionId },
    orderBy: { id: "desc" },
    take: limit,
    select: {
      role: true,
      content: true,
    },
  });

  return messages.reverse();
}

export async function getAllMessages(sessionId) {
  return prisma.conversationMessage.findMany({
    where: { sessionId },
    orderBy: { id: "asc" },
    select: {
      role: true,
      content: true,
    },
  });
}