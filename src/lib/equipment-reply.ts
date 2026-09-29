import { revalidatePath } from "next/cache";
import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  ageCutoff,
  applyProduct,
  equipmentFields,
  equipmentGap,
  equipmentGapPacket,
  equipmentPayload,
  equipmentProposalPacket,
  olderFleetPacket,
  periodGapPacket,
  previousYearWindow,
  readEquipmentEntry,
  readEquipmentQuestion,
  textForProductMatch,
  warrantyPacket,
  type EquipmentPayload,
  type StoredEquipment,
  type WarrantyLevel,
} from "@/domain/equipment";
import { uniqueNameMatch } from "@/domain/knowledge";
import { PRODUCT_FAMILIES, type ProductFamily } from "@/domain/measures";
import { stampProvenance } from "@/domain/provenance";
import { pendingInThread } from "@/domain/proposal-scope";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type EquipmentReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: { fields: Array<{ label: string; value: string }> };
};

export async function resolveEquipment(text: string, conversationId: string, now = new Date()): Promise<EquipmentReply | null> {
  const question = readEquipmentQuestion(text);
  if (question) return answerQuestion(question, now);
  const sketch = readEquipmentEntry(text);
  if (!sketch) return null;
  const [products, clients] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, family: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
  ]);
  const productName = uniqueNameMatch(
    textForProductMatch(text, clients.map((client) => client.name)),
    products.map((product) => product.name),
  );
  const product = productName ? products.find((item) => item.name === productName) ?? null : null;
  const applied = applyProduct(sketch, product);
  const missing = equipmentGap(applied.sketch, applied.conflict);
  if (missing || !applied.sketch.family || !applied.sketch.warranty) {
    const packet = equipmentGapPacket(missing ?? "Indiquez la garantie : 4 h, J+1, standard ou aucune.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const clientName = uniqueNameMatch(text, clients.map((client) => client.name));
  if (!clientName) {
    const absent =
      clients.length === 0
        ? "Aucun client n’est au répertoire. L’équipement n’est pas proposé."
        : "Nommez un seul client déjà enregistré. L’équipement n’est pas proposé.";
    const packet = equipmentGapPacket(absent);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const client = clients.find((item) => item.name === clientName);
  if (!client) return null;
  const draft: EquipmentPayload = {
    clientId: client.id,
    clientName: client.name,
    productId: product && !applied.conflict ? product.id : "",
    productName: product && !applied.conflict ? product.name : "",
    designation: applied.sketch.designation,
    family: applied.sketch.family,
    installedOn: applied.sketch.installedOn,
    warranty: applied.sketch.warranty,
  };
  const packet = equipmentProposalPacket(draft);
  const fields = equipmentFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = equipmentGapPacket("Le fil est inconnu. L’équipement n’est pas proposé.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.installedEquipmentProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  await prisma.installedEquipmentProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: draft,
      ...stampProvenance("regle", fields),
    },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

export async function confirmEquipmentProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingEquipmentProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas d’équipement en attente." };
  const draft = equipmentPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition d’équipement est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. L’équipement n’est pas enregistré." };
  const product = draft.productId
    ? await prisma.product.findUnique({ where: { id: draft.productId }, select: { id: true } })
    : null;
  await withChangeSource("assistant", () =>
    prisma.installedEquipment.create({
      data: {
        clientId: client.id,
        productId: product?.id ?? null,
        designation: draft.designation,
        family: draft.family,
        installedOn: draft.installedOn,
        warranty: draft.warranty,
        confirmedAt: new Date(),
      },
    }),
  );
  await prisma.installedEquipmentProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return {
    ok: true,
    summary: `${draft.designation} pour ${client.name} enregistré. Validation enregistrée.`,
  };
}

export async function rejectEquipmentProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingEquipmentProposal(conversationId);
  if (!row) return null;
  await prisma.installedEquipmentProposal.update({
    where: { id: row.id },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { reply: "L’équipement n’est pas enregistré." };
}

export async function pendingEquipmentProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.installedEquipmentProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

async function answerQuestion(
  question: NonNullable<ReturnType<typeof readEquipmentQuestion>>,
  now: Date,
): Promise<EquipmentReply> {
  if (question.kind === "warranty" && question.period !== "previous_year") {
    const packet = periodGapPacket();
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const [stored, pending] = await Promise.all([
    loadEquipment(),
    prisma.installedEquipmentProposal.count({ where: { status: "en_attente" } }),
  ]);
  const packet =
    question.kind === "warranty"
      ? warrantyPacket({ rows: stored, levels: question.levels, ...previousYearWindow(now), pending })
      : olderFleetPacket({ rows: stored, families: question.families, cutoff: ageCutoff(now), pending });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function loadEquipment(): Promise<StoredEquipment[]> {
  const rows = await prisma.installedEquipment.findMany({
    select: {
      designation: true,
      family: true,
      installedOn: true,
      warranty: true,
      client: { select: { name: true } },
    },
  });
  return rows.flatMap((row) => {
    if (!isFamily(row.family) || !isWarranty(row.warranty)) return [];
    return [
      {
        clientName: row.client.name,
        designation: row.designation,
        family: row.family,
        installedOn: row.installedOn,
        warranty: row.warranty,
      },
    ];
  });
}

function isFamily(value: string): value is ProductFamily {
  return PRODUCT_FAMILIES.includes(value as ProductFamily);
}

function isWarranty(value: string): value is WarrantyLevel {
  return value === "h4" || value === "j1" || value === "standard" || value === "aucune";
}
