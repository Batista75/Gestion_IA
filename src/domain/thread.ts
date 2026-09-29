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

export function cleanThreadTitle(raw: string): { title: string } | { error: string } {
  const title = raw.trim().replace(/\s+/g, " ");
  if (title.length < 2) return { error: "Le titre doit contenir au moins 2 caractères." };
  if (title.length > 80) return { error: "Le titre tient en 80 caractères." };
  return { title };
}
