export const THREAD_MESSAGE_LIMIT = 40;

export type ThreadSummary = {
  id: string;
  title: string;
  suggested: string;
  updatedAt: string;
  count: number;
};

export function threadIsFull(count: number): boolean {
  return count >= THREAD_MESSAGE_LIMIT;
}

/** Le fil qui s’ouvre quand celui affiché quitte la liste. L’ordre reçu est déjà le plus récent d’abord. */
export function nextOpenThread<T extends { id: string }>(threads: T[], leavingId: string): T | null {
  return threads.find((thread) => thread.id !== leavingId) ?? null;
}

/** Un fil rouvert reprend la tête des fils affichés et quitte les archivés. */
export function restoreThread<T extends { id: string }>(
  open: T[],
  archived: T[],
  id: string,
): { open: T[]; archived: T[] } | null {
  const thread = archived.find((item) => item.id === id);
  if (!thread) return null;
  return {
    open: [thread, ...open.filter((item) => item.id !== id)],
    archived: archived.filter((item) => item.id !== id),
  };
}

export function cleanThreadTitle(raw: string): { title: string } | { error: string } {
  const title = raw.trim().replace(/\s+/g, " ");
  if (title.length < 2) return { error: "Le titre doit contenir au moins 2 caractères." };
  if (title.length > 80) return { error: "Le titre tient en 80 caractères." };
  return { title };
}
