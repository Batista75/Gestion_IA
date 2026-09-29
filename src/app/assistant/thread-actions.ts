"use server";

import { cleanThreadTitle } from "@/domain/thread";
import { isConversationId, loadConversation, type StoredTurn } from "@/lib/conversations";
import { prisma } from "@/lib/db";

export async function loadThreadAction(
  id: string,
): Promise<{ id: string; messages: StoredTurn[]; hidden: number } | null> {
  const thread = await loadConversation(id);
  return thread ? { id: thread.id, messages: thread.messages, hidden: thread.hidden } : null;
}

export async function renameThreadAction(id: string, raw: string): Promise<{ title: string } | { error: string }> {
  if (!isConversationId(id)) return { error: "Ce fil est introuvable." };
  const cleaned = cleanThreadTitle(raw);
  if ("error" in cleaned) return cleaned;
  const existing = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "Ce fil n’a pas encore de message. Écrivez d’abord, puis renommez-le." };
  await prisma.conversation.update({ where: { id }, data: { title: cleaned.title } });
  return { title: cleaned.title };
}
