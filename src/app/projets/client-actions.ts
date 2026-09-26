"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ClientPickState = { message: string | null; ok: boolean };

export async function assignClientAction(
  _previous: ClientPickState,
  formData: FormData,
): Promise<ClientPickState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { message: "Ce projet est introuvable.", ok: false };
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { message: "Choisissez un client du répertoire.", ok: false };
  if (project.clientId === client.id && project.primaryClient === client.name) {
    return { message: "Ce client est déjà celui du dossier.", ok: true };
  }
  await prisma.project.update({
    where: { id: project.id },
    data: { clientId: client.id, primaryClient: client.name },
  });
  await prisma.projectEvent.create({
    data: {
      projectId: project.id,
      kind: "client",
      body: `Client du dossier : ${client.name}.`,
    },
  });
  revalidatePath(`/projets/${project.id}`);
  revalidatePath("/projets");
  return { message: `Client retenu : ${client.name}.`, ok: true };
}
