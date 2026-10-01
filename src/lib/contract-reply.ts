import { revalidatePath } from "next/cache";
import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  contractFields,
  contractGapPacket,
  contractPayload,
  contractProposalPacket,
  duePacket,
  kindLabel,
  monthlyPacket,
  readContractEntry,
  readContractQuestion,
  utcDay,
  type ContractPayload,
  type StoredContract,
} from "@/domain/contracts";
import { uniqueNameMatch } from "@/domain/knowledge";
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

export type ContractReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: ProposalCard;
};

export async function resolveContract(text: string, conversationId: string, now = new Date()): Promise<ContractReply | null> {
  const question = readContractQuestion(text);
  if (question) {
    const [rows, pending] = await Promise.all([
      prisma.contract.findMany({ include: { client: { select: { name: true } } } }),
      prisma.contractProposal.count({ where: { status: "en_attente" } }),
    ]);
    const contracts = rows.flatMap(storedContract);
    const packet =
      question.kind === "due"
        ? duePacket({ contracts, types: question.types, today: utcDay(now), pending })
        : monthlyPacket({ contracts, types: question.types, pending });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const entry = readContractEntry(text);
  if (!entry) return null;
  if (!entry.ready) {
    const packet = contractGapPacket(entry.missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const clientName = uniqueNameMatch(text, clients.map((client) => client.name));
  if (!clientName) {
    const missing =
      clients.length === 0
        ? "Aucun client n’est au répertoire. Le contrat n’est pas proposé."
        : "Nommez un seul client déjà enregistré. Le contrat n’est pas proposé.";
    const packet = contractGapPacket(missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const client = clients.find((item) => item.name === clientName);
  if (!client) return null;
  const draft: ContractPayload = { ...entry.draft, clientId: client.id, clientName: client.name };
  const packet = contractProposalPacket(draft);
  const fields = contractFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = contractGapPacket("Le fil est inconnu. Le contrat n’est pas proposé.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.contractProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  const created = await prisma.contractProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: draft,
      ...stampProvenance("regle", fields),
    },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: proposalCard("contract", created.id, fields) };
}

export async function confirmContractProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingContractProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas de contrat en attente." };
  return applyContractProposal(row);
}

export async function confirmContractProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; summary: string }> {
  const row = await contractProposalTarget(conversationId, proposalId);
  if (!row) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  return applyContractProposal(row);
}

async function applyContractProposal(row: { id: string; payload: unknown; conversationId: string | null }): Promise<{
  ok: boolean;
  summary: string;
}> {
  if (!row.conversationId) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  const conversationId = row.conversationId;
  const draft = contractPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition de contrat est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. Le contrat n’est pas enregistré." };
  const outcome = await runClaimedConfirmation({
    claim: async () => {
      const claimed = await prisma.contractProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_attente" },
        data: { status: "en_cours" },
      });
      return claimed.count === 1;
    },
    write: () =>
      withChangeSource("assistant", () =>
        prisma.contract.create({
          data: {
            clientId: client.id,
            kind: draft.kind,
            startsOn: draft.startsOn,
            endsOn: draft.endsOn,
            periodicity: draft.periodicity,
            amountCents: draft.amountCents,
            confirmedAt: new Date(),
          },
        }),
      ),
    succeeded: () => true,
    markConfirmed: async () => {
      await prisma.contractProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "confirmee", validatedAt: new Date() },
      });
    },
    markFailed: async () => {
      await prisma.contractProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "echec" },
      });
    },
  });
  if (outcome.status !== "confirmed") return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return {
    ok: true,
    summary: `Contrat de ${kindLabel(draft.kind)} pour ${client.name} enregistré. Validation enregistrée.`,
  };
}

export async function rejectContractProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingContractProposal(conversationId);
  if (!row || !row.conversationId) return null;
  const claimed = await prisma.contractProposal.updateMany({
    where: { id: row.id, conversationId: row.conversationId, status: "en_attente" },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { reply: "Le contrat n’est pas enregistré." };
}

export async function rejectContractProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; reply: string }> {
  const row = await contractProposalTarget(conversationId, proposalId);
  if (!row || !row.conversationId) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  const claimed = await prisma.contractProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: row.conversationId },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, reply: "Le contrat n’est pas enregistré." };
}

async function contractProposalTarget(conversationId: string, proposalId: string) {
  const found = await prisma.contractProposal.findFirst({ where: { id: proposalId } });
  const target = selectProposalTarget(
    found
      ? [{ id: found.id, type: "contract", conversationId: found.conversationId, status: found.status }]
      : [],
    { proposalId, proposalType: "contract" },
    conversationId,
  );
  if (!target) return null;
  return prisma.contractProposal.findFirst({
    where: { id: target.id, status: "en_attente", conversationId: target.conversationId },
  });
}

export async function pendingContractProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.contractProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

function storedContract(row: {
  kind: string;
  startsOn: string;
  endsOn: string;
  periodicity: string;
  amountCents: number;
  client: { name: string };
}): StoredContract[] {
  const draft = contractPayload({
    clientId: "stored",
    clientName: row.client.name,
    kind: row.kind,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    periodicity: row.periodicity,
    amountCents: row.amountCents,
  });
  if (!draft) return [];
  return [
    {
      clientName: draft.clientName,
      kind: draft.kind,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      periodicity: draft.periodicity,
      amountCents: draft.amountCents,
    },
  ];
}
