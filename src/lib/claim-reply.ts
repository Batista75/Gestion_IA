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
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type ClaimReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: { fields: Array<{ label: string; value: string }> };
};

export async function resolveClaim(text: string, now = new Date()): Promise<ClaimReply | null> {
  const question = readClaimQuestion(text);
  if (question) return answerQuestion(question, now);
  const claim = readClaimEntry(text);
  if (claim) return proposeClaim(text, claim);
  const back = readReturnEntry(text);
  if (back) return proposeReturn(text, back);
  return null;
}

async function proposeClaim(text: string, sketch: NonNullable<ReturnType<typeof readClaimEntry>>): Promise<ClaimReply> {
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
  await prisma.claimProposal.updateMany({ where: { status: "en_attente" }, data: { status: "remplacee" } });
  await prisma.claimProposal.create({
    data: { status: "en_attente", payload: draft, ...stampProvenance("regle", fields) },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

async function proposeReturn(text: string, sketch: NonNullable<ReturnType<typeof readReturnEntry>>): Promise<ClaimReply> {
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
  await prisma.returnRequestProposal.updateMany({ where: { status: "en_attente" }, data: { status: "remplacee" } });
  await prisma.returnRequestProposal.create({
    data: { status: "en_attente", payload: draft, ...stampProvenance("regle", fields) },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

export async function confirmClaimProposal(): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingClaimProposal();
  if (!row) return { ok: false, summary: "Il n’y a pas de réclamation en attente." };
  const draft = claimPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition de réclamation est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. La réclamation n’est pas enregistrée." };
  await withChangeSource("assistant", () =>
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
  );
  await prisma.claimProposal.update({ where: { id: row.id }, data: { status: "confirmee", validatedAt: new Date() } });
  revalidatePath("/");
  return { ok: true, summary: `Réclamation pour ${client.name} enregistrée. Validation enregistrée.` };
}

export async function confirmReturnProposal(): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingReturnProposal();
  if (!row) return { ok: false, summary: "Il n’y a pas de retour en attente." };
  const draft = returnPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition de retour est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. Le retour n’est pas enregistré." };
  await withChangeSource("assistant", () =>
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
  );
  await prisma.returnRequestProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true, summary: `Retour pour ${client.name} enregistré. Validation enregistrée.` };
}

export async function rejectClaimProposal(): Promise<{ reply: string } | null> {
  const row = await pendingClaimProposal();
  if (!row) return null;
  await prisma.claimProposal.update({ where: { id: row.id }, data: { status: "rejetee", validatedAt: new Date() } });
  revalidatePath("/");
  return { reply: "La réclamation n’est pas enregistrée." };
}

export async function rejectReturnProposal(): Promise<{ reply: string } | null> {
  const row = await pendingReturnProposal();
  if (!row) return null;
  await prisma.returnRequestProposal.update({
    where: { id: row.id },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { reply: "Le retour n’est pas enregistré." };
}

export async function pendingClaimProposal() {
  return prisma.claimProposal.findFirst({ where: { status: "en_attente" }, orderBy: { createdAt: "desc" } });
}

export async function pendingReturnProposal() {
  return prisma.returnRequestProposal.findFirst({ where: { status: "en_attente" }, orderBy: { createdAt: "desc" } });
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
