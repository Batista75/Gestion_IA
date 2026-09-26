"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

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

  await prisma.project.create({
    data: { name, primaryClient, nextAction },
  });

  revalidatePath("/");
  revalidatePath("/projets");
  redirect("/projets");
}

export async function createInboxItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 3) {
    return {
      message: "Décrivez l’information en quelques mots avant de l’enregistrer.",
    };
  }

  await prisma.inboxItem.create({ data: { body } });
  revalidatePath("/");
  return {
    message: "Enregistré dans « À classer ». Aucun projet n’a été créé.",
  };
}
