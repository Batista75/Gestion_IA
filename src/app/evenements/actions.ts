"use server";

import { revalidatePath } from "next/cache";
import { splitActivityTokens } from "@/domain/activity";
import { deleteActivity } from "@/lib/activity";

export type EventDeleteState = { message: string | null; ok: boolean };

export async function deleteEventsAction(
  _previous: EventDeleteState,
  formData: FormData,
): Promise<EventDeleteState> {
  const tokens = formData.getAll("trace").filter((value): value is string => typeof value === "string");
  const split = splitActivityTokens(tokens);
  if (split.records.length + split.actions.length === 0) {
    return { ok: false, message: "Cochez au moins une trace." };
  }
  const count = await deleteActivity(split.records, split.actions);
  revalidatePath("/evenements");
  if (count === 0) {
    return { ok: false, message: "Ces traces ne sont plus dans la liste." };
  }
  const removed = count === 1 ? "1 trace retirée" : `${count} traces retirées`;
  return { ok: true, message: `${removed}. Les fiches, les projets et les pièces restent.` };
}
