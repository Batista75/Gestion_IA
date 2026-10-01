import { revalidatePath } from "next/cache";
import { presentCommand, type CatalogCommand } from "@/domain/catalog";
import { readProvenance, stampProvenance, type FieldConfidence } from "@/domain/provenance";
import {
  confirmContractProposal,
  confirmContractProposalById,
  pendingContractProposal,
  rejectContractProposal,
  rejectContractProposalById,
} from "@/lib/contract-reply";
import {
  confirmInterventionProposal,
  confirmInterventionProposalById,
  pendingInterventionProposal,
  rejectInterventionProposal,
  rejectInterventionProposalById,
} from "@/lib/intervention-reply";
import {
  confirmEquipmentProposal,
  confirmEquipmentProposalById,
  pendingEquipmentProposal,
  rejectEquipmentProposal,
  rejectEquipmentProposalById,
} from "@/lib/equipment-reply";
import {
  confirmPurchaseProposal,
  confirmPurchaseProposalById,
  confirmSupplierTermsProposal,
  confirmSupplierTermsProposalById,
  pendingPurchaseProposal,
  pendingSupplierTermsProposal,
  rejectPurchaseProposal,
  rejectPurchaseProposalById,
  rejectSupplierTermsProposal,
  rejectSupplierTermsProposalById,
} from "@/lib/purchase-reply";
import {
  confirmClaimProposal,
  confirmClaimProposalById,
  confirmReturnProposal,
  confirmReturnProposalById,
  pendingClaimProposal,
  pendingReturnProposal,
  rejectClaimProposal,
  rejectClaimProposalById,
  rejectReturnProposal,
  rejectReturnProposalById,
} from "@/lib/claim-reply";
import { rejectPendingProposal } from "@/domain/conversation-turn";
import {
  confirmClientProposalById,
  confirmCurrentProposal,
  proposeFromParty,
  rejectClientProposalById,
  type ProposalView,
} from "@/lib/client-proposals";
import {
  confirmBusinessPlanProposal,
  pendingBusinessPlanProposal,
  rejectBusinessPlanProposal,
  rejectBusinessPlanProposalById,
} from "@/lib/business-plan-proposals";
import {
  pendingInThread,
  proposalCard,
  runClaimedConfirmation,
  selectProposalTarget,
  selectablePending,
  UNAVAILABLE_PROPOSAL,
  type PendingCandidate,
  type ProposalAction,
  type ProposalKind,
} from "@/domain/proposal-scope";
import { applyCatalogCommand } from "@/lib/catalog-store";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export async function openCatalogProposal(
  command: CatalogCommand,
  conversationId: string,
  provenance?: { modelVersion: "ollama"; confidence: FieldConfidence[] },
): Promise<ProposalView | { clarify: string }> {
  if (!provenance && (command.type === "create_client" || command.type === "update_client")) {
    return proposeFromParty(command, conversationId);
  }
  const scope = pendingInThread(conversationId);
  if (!scope) return { clarify: "Le fil est inconnu. Rien n’est enregistré." };
  const presented = presentCommand(command);
  await prisma.catalogProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  const created = await prisma.catalogProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: command,
      ...storedProvenance(presented.fields, provenance),
    },
  });
  revalidatePath("/");
  return { reply: presented.reply, proposal: proposalCard("catalog", created.id, presented.fields) };
}

export async function confirmCatalogProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const scope = pendingInThread(conversationId);
  if (!scope) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  const row = await prisma.catalogProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  return applyCatalogProposal(row);
}

export async function confirmCatalogProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; summary: string }> {
  const row = await catalogProposalTarget(conversationId, proposalId);
  if (!row) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  return applyCatalogProposal(row);
}

export async function rejectCatalogProposalById(
  conversationId: string,
  proposalId: string,
): Promise<{ ok: boolean; reply: string }> {
  const row = await catalogProposalTarget(conversationId, proposalId);
  if (!row || !row.conversationId) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  const claimed = await prisma.catalogProposal.updateMany({
    where: { id: row.id, status: "en_attente", conversationId: row.conversationId },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reply: UNAVAILABLE_PROPOSAL };
  revalidatePath("/");
  return { ok: true, reply: "Rien n’est enregistré. Reformulez la fiche si besoin." };
}

async function catalogProposalTarget(conversationId: string, proposalId: string) {
  const found = await prisma.catalogProposal.findFirst({ where: { id: proposalId } });
  const target = selectProposalTarget(
    found
      ? [{ id: found.id, type: "catalog", conversationId: found.conversationId, status: found.status }]
      : [],
    { proposalId, proposalType: "catalog" },
    conversationId,
  );
  if (!target) return null;
  return prisma.catalogProposal.findFirst({
    where: { id: target.id, status: "en_attente", conversationId: target.conversationId },
  });
}

async function applyCatalogProposal(row: { id: string; payload: unknown; conversationId: string | null }) {
  if (!row.conversationId) return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  const conversationId = row.conversationId;
  const command = row.payload as CatalogCommand;
  const outcome = await runClaimedConfirmation({
    claim: async () => {
      const claimed = await prisma.catalogProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_attente" },
        data: { status: "en_cours" },
      });
      return claimed.count === 1;
    },
    write: () => withChangeSource("assistant", () => applyCatalogCommand(command)),
    succeeded: (saved) => saved.ok,
    markConfirmed: async () => {
      await prisma.catalogProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "confirmee", validatedAt: new Date() },
      });
    },
    markFailed: async () => {
      await prisma.catalogProposal.updateMany({
        where: { id: row.id, conversationId, status: "en_cours" },
        data: { status: "echec" },
      });
    },
  });
  if (outcome.status !== "confirmed") {
    return "value" in outcome ? outcome.value : { ok: false, summary: UNAVAILABLE_PROPOSAL };
  }
  return outcome.value;
}

export async function rejectLatestWrite(conversationId: string): Promise<{
  reply: string;
  proposal?: ProposalView["proposal"];
} | null> {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  const [client, catalog, contract, intervention, equipment, purchase, terms, claim, returnRequest, businessPlan] = await Promise.all([
    prisma.clientProposal.findFirst({
      where: { status: "en_attente", conversationId: scope.conversationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogProposal.findFirst({
      where: { status: "en_attente", conversationId: scope.conversationId },
      orderBy: { createdAt: "desc" },
    }),
    pendingContractProposal(scope.conversationId),
    pendingInterventionProposal(scope.conversationId),
    pendingEquipmentProposal(scope.conversationId),
    pendingPurchaseProposal(scope.conversationId),
    pendingSupplierTermsProposal(scope.conversationId),
    pendingClaimProposal(scope.conversationId),
    pendingReturnProposal(scope.conversationId),
    pendingBusinessPlanProposal(scope.conversationId),
  ]);
  if (!client && !catalog && !contract && !intervention && !equipment && !purchase && !terms && !claim && !returnRequest && !businessPlan) return null;
  const newest = choosePending(
    [
      candidate(client, "client"),
      candidate(catalog, "catalog"),
      candidate(contract, "contract"),
      candidate(intervention, "intervention"),
      candidate(equipment, "equipment"),
      candidate(purchase, "purchase"),
      candidate(terms, "supplierTerms"),
      candidate(claim, "claim"),
      candidate(returnRequest, "returnRequest"),
      candidate(businessPlan, "businessPlan"),
    ],
    scope.conversationId,
  );
  if (!newest) return null;
  if (newest.kind === "businessPlan") {
    const rejected = await rejectBusinessPlanProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "returnRequest") {
    const rejected = await rejectReturnProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "claim") {
    const rejected = await rejectClaimProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "supplierTerms") {
    const rejected = await rejectSupplierTermsProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "purchase") {
    const rejected = await rejectPurchaseProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "equipment") {
    const rejected = await rejectEquipmentProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "intervention") {
    const rejected = await rejectInterventionProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest.kind === "contract") {
    const rejected = await rejectContractProposal(scope.conversationId);
    return rejected ? { reply: rejected.reply } : null;
  }
  const catalogFirst = newest?.kind === "catalog";
  if (catalogFirst && catalog) {
    const claimed = await prisma.catalogProposal.updateMany({
      where: { id: catalog.id, conversationId: scope.conversationId, status: "en_attente" },
      data: { status: "rejetee", validatedAt: new Date() },
    });
    if (claimed.count !== 1) return { reply: UNAVAILABLE_PROPOSAL };
    revalidatePath("/");
    return { reply: "Rien n’est enregistré. Reformulez la fiche si besoin." };
  }
  if (newest.kind === "client" && client) {
    const decision = rejectPendingProposal(
      { status: client.status, validatedAt: null },
      new Date().toISOString(),
    );
    if (!decision.changed || !decision.row.validatedAt) return { reply: UNAVAILABLE_PROPOSAL };
    const claimed = await prisma.clientProposal.updateMany({
      where: { id: client.id, conversationId: scope.conversationId, status: "en_attente" },
      data: { status: decision.row.status, validatedAt: new Date(decision.row.validatedAt) },
    });
    if (claimed.count !== 1) return { reply: UNAVAILABLE_PROPOSAL };
    revalidatePath("/");
    return { reply: "La proposition a été annulée. Rien n’a été enregistré." };
  }
  return { reply: "Il n’y a pas de fiche en attente." };
}

export async function confirmLatestWrite(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const scope = pendingInThread(conversationId);
  if (!scope) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  const [client, catalog, contract, intervention, equipment, purchase, terms, claim, returnRequest, businessPlan] = await Promise.all([
    prisma.clientProposal.findFirst({
      where: { status: "en_attente", conversationId: scope.conversationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogProposal.findFirst({
      where: { status: "en_attente", conversationId: scope.conversationId },
      orderBy: { createdAt: "desc" },
    }),
    pendingContractProposal(scope.conversationId),
    pendingInterventionProposal(scope.conversationId),
    pendingEquipmentProposal(scope.conversationId),
    pendingPurchaseProposal(scope.conversationId),
    pendingSupplierTermsProposal(scope.conversationId),
    pendingClaimProposal(scope.conversationId),
    pendingReturnProposal(scope.conversationId),
    pendingBusinessPlanProposal(scope.conversationId),
  ]);
  const newest = choosePending(
    [
      candidate(client, "client"),
      candidate(catalog, "catalog"),
      candidate(contract, "contract"),
      candidate(intervention, "intervention"),
      candidate(equipment, "equipment"),
      candidate(purchase, "purchase"),
      candidate(terms, "supplierTerms"),
      candidate(claim, "claim"),
      candidate(returnRequest, "returnRequest"),
      candidate(businessPlan, "businessPlan"),
    ],
    scope.conversationId,
  );
  if (!newest) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  if (newest.kind === "businessPlan") return confirmBusinessPlanProposal(scope.conversationId, newest.id);
  return withChangeSource("assistant", () => {
    if (newest.kind === "returnRequest") return confirmReturnProposal(scope.conversationId);
    if (newest.kind === "claim") return confirmClaimProposal(scope.conversationId);
    if (newest.kind === "supplierTerms") return confirmSupplierTermsProposal(scope.conversationId);
    if (newest.kind === "purchase") return confirmPurchaseProposal(scope.conversationId);
    if (newest.kind === "equipment") return confirmEquipmentProposal(scope.conversationId);
    if (newest.kind === "intervention") return confirmInterventionProposal(scope.conversationId);
    if (newest.kind === "contract") return confirmContractProposal(scope.conversationId);
    if (newest.kind === "catalog") return confirmCatalogProposal(scope.conversationId);
    return confirmCurrentProposal(scope.conversationId);
  });
}

function storedProvenance(
  fields: Array<{ label: string; value: string }>,
  provenance?: { modelVersion: "ollama"; confidence: FieldConfidence[] },
): { modelVersion: string; confidence: FieldConfidence[] } {
  if (!provenance) return stampProvenance("regle", fields);
  const read = readProvenance({ modelVersion: provenance.modelVersion, fields: provenance.confidence });
  if ("error" in read) return stampProvenance("regle", fields);
  return read;
}

function candidate(
  row: { id: string; createdAt: Date; conversationId: string | null } | null,
  kind: ProposalKind,
): PendingCandidate | null {
  if (!row) return null;
  return {
    id: row.id,
    kind,
    conversationId: row.conversationId,
    status: "en_attente",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function applyProposalAction(
  conversationId: string,
  action: ProposalAction,
): Promise<{ ok: boolean; reply: string }> {
  if (action.action === "reject") {
    const rejected = await rejectProposalById(conversationId, action);
    return { ok: rejected.ok, reply: rejected.reply };
  }
  const saved = await confirmProposalById(conversationId, action);
  return { ok: saved.ok, reply: saved.summary };
}

async function confirmProposalById(
  conversationId: string,
  action: ProposalAction,
): Promise<{ ok: boolean; summary: string }> {
  if (action.proposalType === "client") return confirmClientProposalById(conversationId, action.proposalId);
  if (action.proposalType === "catalog") return confirmCatalogProposalById(conversationId, action.proposalId);
  if (action.proposalType === "contract") return confirmContractProposalById(conversationId, action.proposalId);
  if (action.proposalType === "intervention") return confirmInterventionProposalById(conversationId, action.proposalId);
  if (action.proposalType === "equipment") return confirmEquipmentProposalById(conversationId, action.proposalId);
  if (action.proposalType === "purchase") return confirmPurchaseProposalById(conversationId, action.proposalId);
  if (action.proposalType === "supplierTerms") return confirmSupplierTermsProposalById(conversationId, action.proposalId);
  if (action.proposalType === "claim") return confirmClaimProposalById(conversationId, action.proposalId);
  if (action.proposalType === "returnRequest") return confirmReturnProposalById(conversationId, action.proposalId);
  const saved = await confirmBusinessPlanProposal(conversationId, action.proposalId);
  if (
    !saved.ok &&
    (saved.summary === "Il n’y a pas de fiche en attente." || saved.summary === "Cette proposition est déjà enregistrée.")
  ) {
    return { ok: false, summary: UNAVAILABLE_PROPOSAL };
  }
  return saved;
}

async function rejectProposalById(
  conversationId: string,
  action: ProposalAction,
): Promise<{ ok: boolean; reply: string }> {
  if (action.proposalType === "client") return rejectClientProposalById(conversationId, action.proposalId);
  if (action.proposalType === "catalog") return rejectCatalogProposalById(conversationId, action.proposalId);
  if (action.proposalType === "contract") return rejectContractProposalById(conversationId, action.proposalId);
  if (action.proposalType === "intervention") return rejectInterventionProposalById(conversationId, action.proposalId);
  if (action.proposalType === "equipment") return rejectEquipmentProposalById(conversationId, action.proposalId);
  if (action.proposalType === "purchase") return rejectPurchaseProposalById(conversationId, action.proposalId);
  if (action.proposalType === "supplierTerms") return rejectSupplierTermsProposalById(conversationId, action.proposalId);
  if (action.proposalType === "claim") return rejectClaimProposalById(conversationId, action.proposalId);
  if (action.proposalType === "returnRequest") return rejectReturnProposalById(conversationId, action.proposalId);
  return rejectBusinessPlanProposalById(conversationId, action.proposalId);
}

function choosePending(rows: Array<PendingCandidate | null>, conversationId: string): PendingCandidate | null {
  return selectablePending(rows.filter((row): row is PendingCandidate => row !== null), conversationId);
}

/** Identifiants en attente du fil. Lecture seule : rien n’est confirmé. */
export async function pendingProposalRoster(conversationId: string): Promise<{
  clientId: string | null;
  ids: string[];
}> {
  const scope = pendingInThread(conversationId);
  if (!scope) return { clientId: null, ids: [] };
  const where = { status: "en_attente" as const, conversationId: scope.conversationId };
  const orderBy = { createdAt: "desc" as const };
  const [client, catalog, contract, intervention, equipment, purchase, terms, claim, returnRequest, businessPlan] =
    await Promise.all([
      prisma.clientProposal.findFirst({ where, orderBy, select: { id: true } }),
      prisma.catalogProposal.findFirst({ where, orderBy, select: { id: true } }),
      pendingContractProposal(conversationId),
      pendingInterventionProposal(conversationId),
      pendingEquipmentProposal(conversationId),
      pendingPurchaseProposal(conversationId),
      pendingSupplierTermsProposal(conversationId),
      pendingClaimProposal(conversationId),
      pendingReturnProposal(conversationId),
      pendingBusinessPlanProposal(conversationId),
    ]);
  const ids = [client, catalog, contract, intervention, equipment, purchase, terms, claim, returnRequest, businessPlan].flatMap(
    (row) => (row ? [row.id] : []),
  );
  return { clientId: client?.id ?? null, ids };
}
