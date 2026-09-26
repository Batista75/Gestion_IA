import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolveStoredPath } from "@/lib/pieces";

export type AdminResult = { ok: boolean; summary: string };

export async function removeClient(id: string): Promise<AdminResult> {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return missing("client");
  await forget("client", id);
  await prisma.client.delete({ where: { id } });
  return { ok: true, summary: `Client « ${client.name} » supprimé.` };
}

export async function removeSupplier(id: string): Promise<AdminResult> {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return missing("fournisseur");
  await forget("supplier", id);
  await prisma.supplier.delete({ where: { id } });
  return {
    ok: true,
    summary: `Fournisseur « ${supplier.name} » supprimé. Les produits restent au catalogue.`,
  };
}

export async function removeProduct(id: string): Promise<AdminResult> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { lines: { select: { quoteId: true } } },
  });
  if (!product) return missing("produit");
  const quoteIds = [...new Set(product.lines.map((line) => line.quoteId))];
  await forget("product", id);
  await prisma.product.delete({ where: { id } });
  for (const quoteId of quoteIds) {
    const left = await prisma.quoteLine.count({ where: { quoteId } });
    if (left === 0) {
      await forget("quote", quoteId);
      await prisma.quote.delete({ where: { id: quoteId } }).catch(() => undefined);
    }
  }
  return { ok: true, summary: `Produit « ${product.name} » supprimé.` };
}

export async function removeQuote(id: string): Promise<AdminResult> {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return missing("devis");
  await forget("quote", id);
  await prisma.quote.delete({ where: { id } });
  return {
    ok: true,
    summary: `Devis « ${quote.versionLabel || quote.title} » supprimé. Les produits restent au catalogue.`,
  };
}

export async function updateProject(input: {
  id: string;
  name: string;
  primaryClient: string;
  status: string;
  purpose: string;
  nextAction: string;
}): Promise<AdminResult> {
  const project = await prisma.project.findUnique({ where: { id: input.id } });
  if (!project) return missing("projet");
  const name = input.name.trim().replace(/\s+/g, " ");
  const primaryClient = input.primaryClient.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, summary: "Indiquez un nom de projet d’au moins 2 caractères." };
  if (primaryClient.length < 2) return { ok: false, summary: "Indiquez le client principal." };
  const status = input.status.trim().slice(0, 80) || "À qualifier";
  const purpose = input.purpose.trim().slice(0, 500);
  const nextAction = input.nextAction.trim().slice(0, 200) || "Qualifier le besoin";
  const changed =
    name !== project.name ||
    primaryClient !== project.primaryClient ||
    status !== project.status ||
    purpose !== project.purpose ||
    nextAction !== project.nextAction;
  if (!changed) return { ok: true, summary: "Aucun changement à enregistrer." };
  await prisma.project.update({
    where: { id: project.id },
    data: { name, primaryClient, status, purpose, nextAction },
  });
  await prisma.projectEvent.create({
    data: {
      projectId: project.id,
      kind: "mise à jour",
      body: `Fiche mise à jour : ${name}, client ${primaryClient}, statut ${status}.`,
    },
  });
  await forget("project", project.id);
  return { ok: true, summary: `Projet « ${name} » mis à jour.` };
}

export async function removeProject(id: string): Promise<AdminResult> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return missing("projet");
  await forget("project", id);
  await prisma.project.delete({ where: { id } });
  return {
    ok: true,
    summary: `Projet « ${project.name} » supprimé. Les devis restent au catalogue, sans ce dossier.`,
  };
}

export async function updateInboxNote(id: string, body: string): Promise<AdminResult> {
  const item = await prisma.inboxItem.findUnique({
    where: { id },
    include: { files: { select: { id: true } } },
  });
  if (!item) return missing("note");
  const text = body.trim().slice(0, 8000);
  if (text.length < 1 && item.files.length === 0) {
    return { ok: false, summary: "Écrivez la note, ou supprimez-la." };
  }
  await prisma.inboxItem.update({
    where: { id },
    data: { body: text || "Note sans texte." },
  });
  await forget("inbox", id);
  return { ok: true, summary: "Note mise à jour." };
}

export async function removeInbox(id: string): Promise<AdminResult> {
  const item = await prisma.inboxItem.findUnique({
    where: { id },
    include: { files: true },
  });
  if (!item) return missing("note");
  for (const file of item.files) {
    await eraseFile(file.id, file.storagePath);
  }
  await forget("inbox", id);
  await prisma.inboxItem.delete({ where: { id } });
  return { ok: true, summary: "Note et documents associés supprimés." };
}

export async function removeStoredFile(id: string): Promise<AdminResult> {
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return missing("document");
  await eraseFile(id, file.storagePath);
  await prisma.storedFile.delete({ where: { id } });
  return { ok: true, summary: `Document « ${file.originalName} » supprimé.` };
}

async function eraseFile(id: string, storagePath: string): Promise<void> {
  const absolute = resolveStoredPath(storagePath);
  if (absolute) await unlink(absolute).catch(() => undefined);
  await prisma.projectEvent.updateMany({ where: { fileId: id }, data: { fileId: "" } });
  await forget("piece", id);
}

async function forget(sourceType: string, sourceId: string): Promise<void> {
  await prisma.knowledgeChunk.deleteMany({ where: { sourceType, sourceId } });
}

function missing(label: string): AdminResult {
  return { ok: false, summary: `Ce ${label} n’existe plus.` };
}
