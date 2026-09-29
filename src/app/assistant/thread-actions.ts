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

export async function archiveThreadAction(id: string): Promise<{ ok: true } | { error: string }> {
  if (!isConversationId(id)) return { error: "Ce fil est introuvable." };
  const existing = await prisma.conversation.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
  if (!existing) return { error: "Ce fil n’a pas encore de message." };
  if (existing.archivedAt) return { ok: true };
  await prisma.conversation.update({ where: { id }, data: { archivedAt: new Date() } });
  return { ok: true };
}

export async function restoreThreadAction(id: string): Promise<{ ok: true } | { error: string }> {
  if (!isConversationId(id)) return { error: "Ce fil est introuvable." };
  const existing = await prisma.conversation.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
  if (!existing) return { error: "Ce fil est introuvable." };
  if (!existing.archivedAt) return { ok: true };
  await prisma.conversation.update({ where: { id }, data: { archivedAt: null } });
  return { ok: true };
}

export async function deleteThreadAction(id: string): Promise<{ ok: true } | { error: string }> {
  if (!isConversationId(id)) return { error: "Ce fil est introuvable." };
  const existing = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "Ce fil n’a pas encore de message." };
  await prisma.conversation.delete({ where: { id } });
  return { ok: true };
}
