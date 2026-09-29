import { revalidatePath } from "next/cache";
import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  averageRatePacket,
  delayPacket,
  interventionFields,
  interventionPayload,
  interventionProposalPacket,
  kindLabel,
  monthWindow,
  quarterWindow,
  readInterventionEntry,
  readTimeQuestion,
  recapPacket,
  threeMonthWindow,
  timeGapPacket,
  unbilledHoursPacket,
  type InterventionPayload,
  type StoredIntervention,
} from "@/domain/interventions";
import { uniqueNameMatch } from "@/domain/knowledge";
import { stampProvenance } from "@/domain/provenance";
import { pendingInThread } from "@/domain/proposal-scope";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type InterventionReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: { fields: Array<{ label: string; value: string }> };
};

export async function resolveIntervention(text: string, conversationId: string, now = new Date()): Promise<InterventionReply | null> {
  const question = readTimeQuestion(text);
  if (question) return answerQuestion(question, text, now);
  const entry = readInterventionEntry(text);
  if (!entry) return null;
  if (!entry.ready) {
    const packet = timeGapPacket("Intervention à confirmer", entry.missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const clientName = uniqueNameMatch(text, clients.map((client) => client.name));
  if (!clientName) {
    const missing =
      clients.length === 0
        ? "Aucun client n’est au répertoire. L’intervention n’est pas proposée."
        : "Nommez un seul client déjà enregistré. L’intervention n’est pas proposée.";
    const packet = timeGapPacket("Intervention à confirmer", missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const client = clients.find((item) => item.name === clientName);
  if (!client) return null;
  const projects = await prisma.project.findMany({
    where: { clientId: client.id },
    select: { id: true, name: true },
  });
  const projectName = uniqueNameMatch(text, projects.map((project) => project.name));
  const project = projectName
    ? projects.find((item) => item.name === projectName) ?? null
    : projects.length === 1
      ? projects[0]
      : null;
  if (!project) {
    const missing =
      projects.length === 0
        ? "Aucun dossier n’est ouvert pour ce client. L’intervention n’est pas proposée."
        : `Plusieurs dossiers existent : ${projects.map((item) => item.name).join(", ")}. Nommez-en un.`;
    const packet = timeGapPacket("Intervention à confirmer", missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const draft: InterventionPayload = {
    ...entry.draft,
    clientId: client.id,
    clientName: client.name,
    projectId: project.id,
    projectName: project.name,
  };
  const packet = interventionProposalPacket(draft);
  const fields = interventionFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = timeGapPacket("Intervention à confirmer", "Le fil est inconnu. L’intervention n’est pas proposée.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.interventionProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  await prisma.interventionProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: draft,
      ...stampProvenance("regle", fields),
    },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

export async function confirmInterventionProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingInterventionProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas d’intervention en attente." };
  const draft = interventionPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition d’intervention est illisible." };
  const project = await prisma.project.findFirst({
    where: { id: draft.projectId, clientId: draft.clientId },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
  if (!project) return { ok: false, summary: "Ce dossier est introuvable. L’intervention n’est pas enregistrée." };
  await withChangeSource("assistant", () =>
    prisma.intervention.create({
      data: {
        clientId: draft.clientId,
        projectId: project.id,
        kind: draft.kind,
        occurredOn: draft.occurredOn,
        durationMinutes: draft.durationMinutes,
        rateUnit: draft.rateUnit,
        rateCents: draft.rateCents,
        ticket: draft.ticket,
        billedReference: draft.billedReference,
        onSite: draft.onSite,
        underContract: draft.underContract,
        requestedOn: draft.requestedOn,
        arrivedOn: draft.arrivedOn,
        confirmedAt: new Date(),
      },
    }),
  );
  await prisma.interventionProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return {
    ok: true,
    summary: `${kindLabel(draft.kind)} pour ${project.client?.name ?? draft.clientName} enregistrée. Validation enregistrée.`,
  };
}

export async function rejectInterventionProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingInterventionProposal(conversationId);
  if (!row) return null;
  await prisma.interventionProposal.update({
    where: { id: row.id },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { reply: "L’intervention n’est pas enregistrée." };
}

export async function pendingInterventionProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.interventionProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

async function answerQuestion(
  question: NonNullable<ReturnType<typeof readTimeQuestion>>,
  text: string,
  now: Date,
): Promise<InterventionReply> {
  if (question.kind === "average_rate" && question.period !== "quarter") {
    const packet = timeGapPacket(
      "Taux moyen",
      question.period === "missing" ? "Indiquez la période : ce trimestre." : "Le taux moyen se demande sur ce trimestre.",
    );
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "unbilled" && question.period !== "month") {
    const packet = timeGapPacket(
      "Heures non facturées",
      question.period === "missing" ? "Indiquez la période : ce mois." : "Les heures non facturées se demandent sur ce mois.",
    );
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "delay" && question.period !== "three_months") {
    const packet = timeGapPacket(
      "Délai moyen d’intervention",
      question.period === "missing" ? "Indiquez la période : sur trois mois." : "Le délai moyen se demande sur trois mois.",
    );
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const [stored, pending] = await Promise.all([loadInterventions(), prisma.interventionProposal.count({ where: { status: "en_attente" } })]);
  if (question.kind === "recap") {
    const clients = await prisma.client.findMany({ select: { name: true } });
    const clientName = uniqueNameMatch(text, clients.map((client) => client.name));
    if (!clientName) {
      const packet = timeGapPacket("Tickets et heures", "Nommez un seul client déjà enregistré.");
      return { reply: safeReply(packet), packet, source: "regle-metier" };
    }
    const packet = recapPacket({
      rows: stored.filter((row) => row.clientName === clientName),
      clientName,
      pending,
    });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "average_rate") {
    const window = quarterWindow(now);
    const packet = averageRatePacket({ rows: stored, types: question.types, unit: question.unit, ...window, pending });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "unbilled") {
    const window = monthWindow(now);
    const packet = unbilledHoursPacket({ rows: stored, types: question.types, ...window, pending });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const window = threeMonthWindow(now);
  const packet = delayPacket({ rows: stored, ...window, pending });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function loadInterventions(): Promise<StoredIntervention[]> {
  const rows = await prisma.intervention.findMany({
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });
  return rows.flatMap((row) => {
    const draft = interventionPayload({
      clientId: row.clientId,
      clientName: row.client.name,
      projectId: row.projectId,
      projectName: row.project.name,
      kind: row.kind,
      occurredOn: row.occurredOn,
      durationMinutes: row.durationMinutes,
      rateUnit: row.rateUnit,
      rateCents: row.rateCents,
      ticket: row.ticket,
      billedReference: row.billedReference,
      onSite: row.onSite,
      underContract: row.underContract,
      requestedOn: row.requestedOn,
      arrivedOn: row.arrivedOn,
    });
    if (!draft) return [];
    return [draft];
  });
}
