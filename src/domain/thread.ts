export const THREAD_MESSAGE_LIMIT = 40;

export type ThreadSummary = { id: string; title: string; updatedAt: string; count: number };

export function threadIsFull(count: number): boolean {
  return count >= THREAD_MESSAGE_LIMIT;
}
