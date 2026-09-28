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
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type ContractReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: { fields: Array<{ label: string; value: string }> };
};

export async function resolveContract(text: string, now = new Date()): Promise<ContractReply | null> {
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
  await prisma.contractProposal.updateMany({
    where: { status: "en_attente" },
    data: { status: "remplacee" },
  });
  await prisma.contractProposal.create({
    data: { status: "en_attente", payload: draft, ...stampProvenance("regle", fields) },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

export async function confirmContractProposal(): Promise<{ ok: boolean; summary: string }> {
  const row = await prisma.contractProposal.findFirst({
    where: { status: "en_attente" },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, summary: "Il n’y a pas de contrat en attente." };
  const draft = contractPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition de contrat est illisible." };
  const client = await prisma.client.findUnique({ where: { id: draft.clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, summary: "Ce client est introuvable. Le contrat n’est pas enregistré." };
  await withChangeSource("assistant", () =>
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
  );
  await prisma.contractProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return {
    ok: true,
    summary: `Contrat de ${kindLabel(draft.kind)} pour ${client.name} enregistré. Validation enregistrée.`,
  };
}

export async function rejectContractProposal(): Promise<{ reply: string } | null> {
  const row = await prisma.contractProposal.findFirst({
    where: { status: "en_attente" },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  await prisma.contractProposal.update({
    where: { id: row.id },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { reply: "Le contrat n’est pas enregistré." };
}

export async function pendingContractProposal() {
  return prisma.contractProposal.findFirst({
    where: { status: "en_attente" },
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
