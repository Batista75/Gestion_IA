import { revalidatePath } from "next/cache";
import {
  businessPlanDecision,
  pendingInThread,
  presentBusinessPlan,
  readStoredPlan,
  settleBusinessPlan,
} from "@/domain/proposal-scope";
import type { BusinessPlan } from "@/domain/business-brief";
import { stampProvenance } from "@/domain/provenance";
import { applyBusinessPlan, type AttachedPiece } from "@/lib/business-records";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";
import { refreshInboxStatus } from "@/lib/inbox-entry";

export async function openBusinessPlanProposal(
  plan: BusinessPlan,
  conversationId: string,
  inboxItemId: string | null = null,
): Promise<{ reply: string; proposal: { fields: Array<{ label: string; value: string }> } } | { clarify: string }> {
  const scope = pendingInThread(conversationId);
  if (!scope) return { clarify: "Le fil est inconnu. Rien n’est enregistré." };
  const presented = presentBusinessPlan(plan);
  const previous = await prisma.businessPlanProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
    select: { inboxItemId: true },
  });
  const linked = inboxItemId ?? previous?.inboxItemId ?? null;
  await prisma.businessPlanProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  await prisma.businessPlanProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      inboxItemId: linked,
      payload: plan,
      ...stampProvenance("regle", presented.fields),
    },
  });
  await refreshInboxStatus(previous?.inboxItemId);
  await refreshInboxStatus(linked);
  revalidatePath("/");
  return { reply: presented.reply, proposal: { fields: presented.fields } };
}

export async function pendingBusinessPlanProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.businessPlanProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function confirmBusinessPlanProposal(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; summary: string }> {
  const scope = pendingInThread(conversationId);
  if (!scope) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  const row = await prisma.businessPlanProposal.findFirst({
    where: { id: proposalId, conversationId: scope.conversationId },
  });
  if (!row) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  const decision = businessPlanDecision({
    status: row.status,
    conversationId: row.conversationId,
    currentConversationId: scope.conversationId,
    explicitConfirmation: true,
  });
  if (decision === "deja_execute") {
    return { ok: false, summary: "Cette proposition est déjà enregistrée." };
  }
  if (decision !== "executer") {
    return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  }
  const stored = readStoredPlan(row.payload);
  if (!stored) return { ok: false, summary: "Cette proposition est illisible. Rien n’est enregistré." };
  const claimed = await prisma.businessPlanProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: scope.conversationId },
    data: { status: "en_cours", failureNote: "" },
  });
  if (claimed.count !== 1) {
    return { ok: false, summary: "Cette proposition est déjà enregistrée." };
  }
  let result: { ok: boolean; summary: string };
  try {
    const attached = row.inboxItemId ? await loadInboxFiles(row.inboxItemId) : await loadPieces(stored.fileIds);
    const saved = await withChangeSource("assistant", () => applyBusinessPlan(stored.plan, attached));
    const settled = settleBusinessPlan(saved.ok ? "succes" : "echec");
    await prisma.businessPlanProposal.update({
      where: { id: row.id },
      data: {
        status: settled.status,
        validatedAt: settled.validated ? new Date() : null,
        failureNote: settled.status === "echec" ? saved.summary.slice(0, 200) : "",
      },
    });
    result = saved;
  } catch (error) {
    const note = failureNote(error);
    const settled = settleBusinessPlan("echec");
    await prisma.businessPlanProposal.update({
      where: { id: row.id },
      data: { status: settled.status, validatedAt: null, failureNote: note },
    });
    result = { ok: false, summary: note };
  }
  await syncInboxAfterDecision(row.inboxItemId);
  revalidatePath("/");
  return result;
}

async function syncInboxAfterDecision(inboxItemId: string | null): Promise<void> {
  try {
    await refreshInboxStatus(inboxItemId);
  } catch {
    // La proposition est déjà confirmee ou echec. Ce statut n’est pas réécrit.
  }
}

async function loadInboxFiles(inboxItemId: string): Promise<AttachedPiece[]> {
  const rows = await prisma.storedFile.findMany({
    where: { inboxItemId },
    orderBy: { createdAt: "asc" },
    select: { id: true, originalName: true, extractedText: true },
  });
  return rows.map((row) => ({ id: row.id, originalName: row.originalName, text: row.extractedText }));
}

async function loadPieces(fileIds: string[]): Promise<AttachedPiece[]> {
  if (fileIds.length === 0) return [];
  const rows = await prisma.storedFile.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, originalName: true, extractedText: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return fileIds.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    return [{ id: row.id, originalName: row.originalName, text: row.extractedText }];
  });
}

function failureNote(error: unknown): string {
  const raw = error instanceof Error ? error.message : "L’enregistrement n’a pas abouti.";
  const note = raw.replace(/\s+/g, " ").trim().slice(0, 200);
  return note || "L’enregistrement n’a pas abouti.";
}

export async function rejectBusinessPlanProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingBusinessPlanProposal(conversationId);
  if (!row) return null;
  await prisma.businessPlanProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: row.conversationId },
    data: { status: "rejetee" },
  });
  await refreshInboxStatus(row.inboxItemId);
  revalidatePath("/");
  return { reply: "Rien n’est enregistré." };
}
