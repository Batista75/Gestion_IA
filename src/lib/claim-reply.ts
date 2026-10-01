import { revalidatePath } from "next/cache";
import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  CLAIM_KINDS,
  CLAIM_STATUSES,
  RETURN_KINDS,
  RETURN_STATUSES,
  claimFields,
  claimGap,
  claimGapPacket,
  claimPayload,
  claimPeriodPacket,
  claimProposalPacket,
  claimsPacket,
  monthWindow,
  readClaimEntry,
  readClaimQuestion,
  readReturnEntry,
  returnFields,
  returnGap,
  returnGapPacket,
  returnPayload,
  returnProposalPacket,
  returnsPacket,
  type ClaimKind,
  type ClaimPayload,
  type ClaimStatus,
  type ReturnKind,
  type ReturnPayload,
  type ReturnStatus,
  type StoredClaim,
  type StoredReturn,
} from "@/domain/claims";
import { uniqueNameMatch } from "@/domain/knowledge";
import { stampProvenance } from "@/domain/provenance";
import {
  pendingInThread,
  proposalCard,
  runClaimedConfirmation,
  selectProposalTarget,
  UNAVAILABLE_PROPOSAL,
} from "@/domain/proposal-scope";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type ClaimReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: { fields: Array<{ label: string; value: string }> };
};

export async function resolveClaim(text: string, conversationId: string, now = new Date()): Promise<ClaimReply | null> {
  const question = readClaimQuestion(text);
  if (question) return answerQuestion(question, now);
  const claim = readClaimEntry(text);
  if (claim) return proposeClaim(text, claim, conversationId);
  const back = readReturnEntry(text);
  if (back) return proposeReturn(text, back, conversationId);
  return null;
}

async function proposeClaim(
  text: string,
  sketch: NonNullable<ReturnType<typeof readClaimEntry>>,
  conversationId: string,
): Promise<ClaimReply> {
  const missing = claimGap(sketch);
  if (missing || !sketch.kind || !sketch.status) {
    const packet = claimGapPacket(missing ?? "Indiquez le type : panne au déballage ou retard de livraison.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const client = await namedClient(text);
  if (!client) {
    const packet = claimGapPacket(await clientMissing("La réclamation n’est pas proposée."));
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const draft: ClaimPayload = {
    clientId: client.id,
    clientName: client.name,
    kind: sketch.kind,
    occurredOn: sketch.occurredOn,
    status: sketch.status,
    note: sketch.note,
  };
  const packet = claimProposalPacket(draft);
  const fields = claimFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = claimGapPacket("Le fil est inconnu. La réclamation n’est pas proposée.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.claimProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  const created = await prisma.claimProposal.create({
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
    proposal: proposalCard("claim", created.id, fields),
  };
}

async function proposeReturn(
  text: string,
  sketch: NonNullable<ReturnType<typeof readReturnEntry>>,
  conversationId: string,
): Promise<ClaimReply> {
  const missing = returnGap(sketch);
  if (missing || !sketch.kind || !sketch.status || sketch.underWarranty === null) {
    const packet = returnGapPacket(missing ?? "Indiquez le type : retour ou remplacement.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const client = await namedClient(text);
  if (!client) {
    const packet = returnGapPacket(await clientMissing("Le retour n’est pas proposé."));
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const draft: ReturnPayload = {
    clientId: client.id,
    clientName: client.name,
    kind: sketch.kind,
    occurredOn: sketch.occurredOn,
    status: sketch.status,
    underWarranty: sketch.underWarranty,
    note: sketch.note,
  };
  const packet = returnProposalPacket(draft);
  const fields = returnFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = returnGapPacket("Le fil est inconnu. Le retour n’est pas proposé.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.returnRequestProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  const created = await prisma.returnRequestProposal.create({
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
    proposal: proposalCard("returnRequest", created.id, fields),
  };
}

export async function confirmClaimProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingClaimProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas de réclamation en attente." };
  return applyClaimProposal(row);
}

export async function confirmClaimProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; summary: string }> {
  const row = await claimProposalTarget(conversationId, proposalId);
  if (!row) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  return applyClaimProposal(row);
}

async function applyClaimProposal(row: {
  id: string;
  payload: unknown;
  conversationId: string | null;
}): Promise<{ ok: boolean; summary: string }> {
  if (!row.conversationId) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  const conversationId = row.conversationId;
  const draft = claimPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition de réclamation est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. La réclamation n’est pas enregistrée." };
  const outcome = await runClaimedConfirmation({
    claim: async () => {
      const claimed = await prisma.claimProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_attente" },
        data: { status: "en_cours" },
      });
      return claimed.count === 1;
    },
    write: () =>
      withChangeSource("assistant", () =>
        prisma.claim.create({
          data: {
            clientId: client.id,
            kind: draft.kind,
            occurredOn: draft.occurredOn,
            status: draft.status,
            note: draft.note,
            confirmedAt: new Date(),
          },
        }),
      ),
    succeeded: () => true,
    markConfirmed: async () => {
      await prisma.claimProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "confirmee", validatedAt: new Date() },
      });
    },
    markFailed: async () => {
      await prisma.claimProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "echec" },
      });
    },
  });
  if (outcome.status !== "confirmed") return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, summary: `Réclamation pour ${client.name} enregistrée. Validation enregistrée.` };
}

export async function confirmReturnProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingReturnProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas de retour en attente." };
  return applyReturnProposal(row);
}

export async function confirmReturnProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; summary: string }> {
  const row = await returnProposalTarget(conversationId, proposalId);
  if (!row) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  return applyReturnProposal(row);
}

async function applyReturnProposal(row: {
  id: string;
  payload: unknown;
  conversationId: string | null;
}): Promise<{ ok: boolean; summary: string }> {
  if (!row.conversationId) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  const conversationId = row.conversationId;
  const draft = returnPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition de retour est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. Le retour n’est pas enregistré." };
  const outcome = await runClaimedConfirmation({
    claim: async () => {
      const claimed = await prisma.returnRequestProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_attente" },
        data: { status: "en_cours" },
      });
      return claimed.count === 1;
    },
    write: () =>
      withChangeSource("assistant", () =>
        prisma.returnRequest.create({
          data: {
            clientId: client.id,
            kind: draft.kind,
            occurredOn: draft.occurredOn,
            status: draft.status,
            underWarranty: draft.underWarranty,
            note: draft.note,
            confirmedAt: new Date(),
          },
        }),
      ),
    succeeded: () => true,
    markConfirmed: async () => {
      await prisma.returnRequestProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "confirmee", validatedAt: new Date() },
      });
    },
    markFailed: async () => {
      await prisma.returnRequestProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "echec" },
      });
    },
  });
  if (outcome.status !== "confirmed") return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, summary: `Retour pour ${client.name} enregistré. Validation enregistrée.` };
}

export async function rejectClaimProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingClaimProposal(conversationId);
  if (!row || !row.conversationId) return null;
  const claimed = await prisma.claimProposal.updateMany({
    where: { id: row.id, conversationId: row.conversationId, status: "en_attente" },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { reply: "La réclamation n’est pas enregistrée." };
}

export async function rejectClaimProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; reply: string }> {
  const row = await claimProposalTarget(conversationId, proposalId);
  if (!row || !row.conversationId) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  const claimed = await prisma.claimProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: row.conversationId },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, reply: "La réclamation n’est pas enregistrée." };
}

async function claimProposalTarget(conversationId: string, proposalId: string) {
  const found = await prisma.claimProposal.findFirst({ where: { id: proposalId } });
  const target = selectProposalTarget(
    found
      ? [{ id: found.id, type: "claim", conversationId: found.conversationId, status: found.status }]
      : [],
    { proposalId, proposalType: "claim" },
    conversationId,
  );
  if (!target) return null;
  return prisma.claimProposal.findFirst({
    where: { id: target.id, status: "en_attente", conversationId: target.conversationId },
  });
}

export async function rejectReturnProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingReturnProposal(conversationId);
  if (!row || !row.conversationId) return null;
  const claimed = await prisma.returnRequestProposal.updateMany({
    where: { id: row.id, conversationId: row.conversationId, status: "en_attente" },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { reply: "Le retour n’est pas enregistré." };
}

export async function rejectReturnProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; reply: string }> {
  const row = await returnProposalTarget(conversationId, proposalId);
  if (!row || !row.conversationId) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  const claimed = await prisma.returnRequestProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: row.conversationId },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, reply: "Le retour n’est pas enregistré." };
}

async function returnProposalTarget(conversationId: string, proposalId: string) {
  const found = await prisma.returnRequestProposal.findFirst({ where: { id: proposalId } });
  const target = selectProposalTarget(
    found
      ? [{ id: found.id, type: "returnRequest", conversationId: found.conversationId, status: found.status }]
      : [],
    { proposalId, proposalType: "returnRequest" },
    conversationId,
  );
  if (!target) return null;
  return prisma.returnRequestProposal.findFirst({
    where: { id: target.id, status: "en_attente", conversationId: target.conversationId },
  });
}

export async function pendingClaimProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.claimProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function pendingReturnProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.returnRequestProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

async function answerQuestion(question: NonNullable<ReturnType<typeof readClaimQuestion>>, now: Date): Promise<ClaimReply> {
  if (question.kind === "claims" && question.period !== "month") {
    const packet = claimPeriodPacket(question.period);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "returns" && (question.warrantyConflict || question.warranty !== true || !question.openOnly)) {
    const missing = question.warrantyConflict
      ? "Une seule mention : sous garantie ou hors garantie."
      : question.warranty !== true
        ? "Indiquez que la liste est sous garantie."
        : "Indiquez l’état : en cours.";
    const packet = returnGapPacket(missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "claims") {
    const [rows, pending] = await Promise.all([
      loadClaims(),
      prisma.claimProposal.count({ where: { status: "en_attente" } }),
    ]);
    const packet = claimsPacket({ rows, types: question.types, ...monthWindow(now), pending });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const [rows, pending] = await Promise.all([
    loadReturns(),
    prisma.returnRequestProposal.count({ where: { status: "en_attente" } }),
  ]);
  const packet = returnsPacket({ rows, types: question.types, pending });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function namedClient(text: string): Promise<{ id: string; name: string } | null> {
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const name = uniqueNameMatch(text, clients.map((client) => client.name));
  return clients.find((client) => client.name === name) ?? null;
}

async function clientMissing(sentence: string): Promise<string> {
  const count = await prisma.client.count();
  return count === 0 ? `Aucun client n’est au répertoire. ${sentence}` : `Nommez un seul client déjà enregistré. ${sentence}`;
}

async function loadClaims(): Promise<StoredClaim[]> {
  const rows = await prisma.claim.findMany({
    select: { kind: true, occurredOn: true, status: true, note: true, client: { select: { name: true } } },
  });
  return rows.flatMap((row) => {
    if (!isClaimKind(row.kind) || !isClaimStatus(row.status)) return [];
    return [{ clientName: row.client.name, kind: row.kind, occurredOn: row.occurredOn, status: row.status, note: row.note }];
  });
}

async function loadReturns(): Promise<StoredReturn[]> {
  const rows = await prisma.returnRequest.findMany({
    select: {
      kind: true,
      occurredOn: true,
      status: true,
      underWarranty: true,
      note: true,
      client: { select: { name: true } },
    },
  });
  return rows.flatMap((row) => {
    if (!isReturnKind(row.kind) || !isReturnStatus(row.status)) return [];
    return [
      {
        clientName: row.client.name,
        kind: row.kind,
        occurredOn: row.occurredOn,
        status: row.status,
        underWarranty: row.underWarranty,
        note: row.note,
      },
    ];
  });
}

function isClaimKind(value: string): value is ClaimKind {
  return CLAIM_KINDS.includes(value as ClaimKind);
}

function isClaimStatus(value: string): value is ClaimStatus {
  return CLAIM_STATUSES.includes(value as ClaimStatus);
}

function isReturnKind(value: string): value is ReturnKind {
  return RETURN_KINDS.includes(value as ReturnKind);
}

function isReturnStatus(value: string): value is ReturnStatus {
  return RETURN_STATUSES.includes(value as ReturnStatus);
}
