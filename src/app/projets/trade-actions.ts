"use server";

import { revalidatePath } from "next/cache";
import { saveProjectStep } from "@/lib/trade-steps";

export type TradeState = { message: string | null; ok: boolean };

export async function saveStepAction(_previous: TradeState, formData: FormData): Promise<TradeState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  try {
    const summary = await saveProjectStep({
      projectId,
      stepKey: String(formData.get("stepKey") ?? ""),
      status: String(formData.get("status") ?? ""),
      proofRef: String(formData.get("proofRef") ?? ""),
      proofNote: String(formData.get("proofNote") ?? ""),
    });
    revalidatePath(`/projets/${projectId}`);
    revalidatePath("/projets");
    return { message: summary, ok: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "L’étape n’a pas été enregistrée.",
      ok: false,
    };
  }
}
