import { notedPieceLabel, planNotedPiece } from "@/domain/noted-piece";
import { prisma } from "@/lib/db";

export async function attachNotedPiece(input: {
  projectId: string;
  kind: string;
  reference: string;
  saleParentId: string;
  pieceParentId: string;
}): Promise<string> {
  const saleId = input.saleParentId.trim();
  const pieceId = input.pieceParentId.trim();
  if (Boolean(saleId) === Boolean(pieceId)) {
    throw new Error("Choisissez une seule pièce parente.");
  }
  const parentKind = saleId
    ? await saleKind(input.projectId, saleId)
    : await pieceKind(input.projectId, pieceId);
  const plan = planNotedPiece({ kind: input.kind, reference: input.reference, parentKind });
  if ("error" in plan) throw new Error(plan.error);
  await prisma.notedPiece.create({
    data: {
      projectId: input.projectId,
      kind: plan.kind,
      reference: plan.reference,
      saleParentId: saleId || null,
      pieceParentId: pieceId || null,
    },
  });
  const body = `${notedPieceLabel(plan.kind)} « ${plan.reference} » rattachée. Aucun numéro n’a été attribué.`;
  await prisma.projectEvent.create({
    data: { projectId: input.projectId, kind: plan.kind, body },
  });
  return body;
}

async function saleKind(projectId: string, id: string): Promise<string> {
  const sale = await prisma.saleDocument.findFirst({
    where: { id, projectId },
    select: { kind: true },
  });
  if (!sale) throw new Error("Cette commande n’est pas dans ce dossier.");
  return sale.kind;
}

async function pieceKind(projectId: string, id: string): Promise<string> {
  const piece = await prisma.notedPiece.findFirst({
    where: { id, projectId },
    select: { kind: true },
  });
  if (!piece) throw new Error("Cette pièce n’est pas dans ce dossier.");
  return piece.kind;
}
