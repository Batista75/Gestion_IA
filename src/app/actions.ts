"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureSpokenProject } from "@/lib/business-records";
import { saveInboxPieces } from "@/lib/pieces";

export type ActionState = {
  message: string | null;
};

export async function createProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const primaryClient = String(formData.get("primaryClient") ?? "").trim();
  const nextAction =
    String(formData.get("nextAction") ?? "").trim() || "Qualifier le besoin";

  if (name.length < 2) {
    return { message: "Indiquez un nom de projet d’au moins 2 caractères." };
  }
  if (primaryClient.length < 2) {
    return { message: "Indiquez le client principal." };
  }

  const saved = await ensureSpokenProject({ name, primaryClient, nextAction });
  if (!saved.ok) return { message: saved.summary };

  revalidatePath("/");
  revalidatePath("/projets");
  redirect("/projets");
}

export async function createInboxItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const body = String(formData.get("body") ?? "");
  const uploads = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const files = await Promise.all(
    uploads.map(async (file) => ({
      name: file.name,
      type: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const result = await saveInboxPieces(body, files);
  if (!result.ok) return { message: result.message };
  revalidatePath("/");
  revalidatePath("/produits");
  revalidatePath("/fournisseurs");
  return { message: result.message };
}
