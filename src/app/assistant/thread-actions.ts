"use server";

import { loadConversation, type StoredTurn } from "@/lib/conversations";

export async function loadThreadAction(
  id: string,
): Promise<{ id: string; messages: StoredTurn[]; hidden: number } | null> {
  const thread = await loadConversation(id);
  return thread ? { id: thread.id, messages: thread.messages, hidden: thread.hidden } : null;
}
