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
import {
  pendingInThread,
  proposalCard,
  runClaimedConfirmation,
  selectProposalTarget,
  UNAVAILABLE_PROPOSAL,
  type ProposalCard,
} from "@/domain/proposal-scope";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type EquipmentReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: ProposalCard;
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
  const created = await prisma.installedEquipmentProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: draft,
      ...stampProvenance("regle", fields),
    },
  });
  return {
    reply: safeReply(packet),
    packet,
    source: "proposition",
    proposal: proposalCard("equipment", created.id, fields),
  };
}

export async function confirmEquipmentProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingEquipmentProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas d’équipement en attente." };
  return applyEquipmentProposal(row);
}

export async function confirmEquipmentProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; summary: string }> {
  const row = await equipmentProposalTarget(conversationId, proposalId);
  if (!row) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  return applyEquipmentProposal(row);
}

async function applyEquipmentProposal(row: {
  id: string;
  payload: unknown;
  conversationId: string | null;
}): Promise<{ ok: boolean; summary: string }> {
  if (!row.conversationId) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  const conversationId = row.conversationId;
  const draft = equipmentPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition d’équipement est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. L’équipement n’est pas enregistré." };
  const product = draft.productId
    ? await prisma.product.findUnique({ where: { id: draft.productId }, select: { id: true } })
    : null;
  const outcome = await runClaimedConfirmation({
    claim: async () => {
      const claimed = await prisma.installedEquipmentProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_attente" },
        data: { status: "en_cours" },
      });
      return claimed.count === 1;
    },
    write: () =>
      withChangeSource("assistant", () =>
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
      ),
    succeeded: () => true,
    markConfirmed: async () => {
      await prisma.installedEquipmentProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "confirmee", validatedAt: new Date() },
      });
    },
    markFailed: async () => {
      await prisma.installedEquipmentProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "echec" },
      });
    },
  });
  if (outcome.status !== "confirmed") return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return {
    ok: true,
    summary: `${draft.designation} pour ${client.name} enregistré. Validation enregistrée.`,
  };
}

export async function rejectEquipmentProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingEquipmentProposal(conversationId);
  if (!row || !row.conversationId) return null;
  const claimed = await prisma.installedEquipmentProposal.updateMany({
    where: { id: row.id, conversationId: row.conversationId, status: "en_attente" },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { reply: "L’équipement n’est pas enregistré." };
}

export async function rejectEquipmentProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; reply: string }> {
  const row = await equipmentProposalTarget(conversationId, proposalId);
  if (!row || !row.conversationId) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  const claimed = await prisma.installedEquipmentProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: row.conversationId },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, reply: "L’équipement n’est pas enregistré." };
}

async function equipmentProposalTarget(conversationId: string, proposalId: string) {
  const found = await prisma.installedEquipmentProposal.findFirst({ where: { id: proposalId } });
  const target = selectProposalTarget(
    found
      ? [{ id: found.id, type: "equipment", conversationId: found.conversationId, status: found.status }]
      : [],
    { proposalId, proposalType: "equipment" },
    conversationId,
  );
  if (!target) return null;
  return prisma.installedEquipmentProposal.findFirst({
    where: { id: target.id, status: "en_attente", conversationId: target.conversationId },
  });
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
