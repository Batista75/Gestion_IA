"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureSpokenProject } from "@/lib/business-records";
import { prisma } from "@/lib/db";
import { isConversationId, rememberTurn } from "@/lib/conversations";
import { saveInboxPieces } from "@/lib/pieces";

export type ActionState = {
  message: string | null;
};

export async function createProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const nextAction =
    String(formData.get("nextAction") ?? "").trim() || "Qualifier le besoin";

  if (name.length < 2) {
    return { message: "Indiquez un nom de projet d’au moins 2 caractères." };
  }
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  if (!client) {
    return { message: "Choisissez un client du répertoire." };
  }

  const saved = await ensureSpokenProject({ name, primaryClient: client.name, nextAction });
  if (!saved.ok) return { message: saved.summary };
  if (saved.projectId) {
    await prisma.project.update({
      where: { id: saved.projectId },
      data: { clientId: client.id, primaryClient: client.name },
    });
  }

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

export async function recordExchangeAction(input: {
  conversationId: string;
  userText: string;
  assistantText: string;
}): Promise<{ ok: boolean }> {
  if (!isConversationId(input.conversationId)) return { ok: false };
  const userText = input.userText.trim().slice(0, 12_000);
  const assistantText = input.assistantText.trim().slice(0, 12_000) || "Pièce enregistrée.";
  if (userText) {
    await rememberTurn({
      conversationId: input.conversationId,
      role: "user",
      content: userText,
      linkText: userText,
    });
  }
  await rememberTurn({
    conversationId: input.conversationId,
    role: "assistant",
    content: assistantText,
    source: "action",
    steps: ["Pièces enregistrées"],
  });
  return { ok: true };
}
