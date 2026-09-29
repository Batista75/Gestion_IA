import { revalidatePath } from "next/cache";
import { presentCommand, type CatalogCommand } from "@/domain/catalog";
import { stampProvenance } from "@/domain/provenance";
import { proposalFields } from "@/domain/client-file";
import { confirmContractProposal, pendingContractProposal, rejectContractProposal } from "@/lib/contract-reply";
import {
  confirmInterventionProposal,
  pendingInterventionProposal,
  rejectInterventionProposal,
} from "@/lib/intervention-reply";
import { confirmEquipmentProposal, pendingEquipmentProposal, rejectEquipmentProposal } from "@/lib/equipment-reply";
import {
  confirmPurchaseProposal,
  confirmSupplierTermsProposal,
  pendingPurchaseProposal,
  pendingSupplierTermsProposal,
  rejectPurchaseProposal,
  rejectSupplierTermsProposal,
} from "@/lib/purchase-reply";
import {
  confirmClaimProposal,
  confirmReturnProposal,
  pendingClaimProposal,
  pendingReturnProposal,
  rejectClaimProposal,
  rejectReturnProposal,
} from "@/lib/claim-reply";
import { confirmCurrentProposal, currentProposal, proposeFromParty, type ProposalView } from "@/lib/client-proposals";
import {
  confirmBusinessPlanProposal,
  pendingBusinessPlanProposal,
  rejectBusinessPlanProposal,
} from "@/lib/business-plan-proposals";
import { pendingInThread, selectablePending, type PendingCandidate, type ProposalKind } from "@/domain/proposal-scope";
import { applyCatalogCommand } from "@/lib/catalog-store";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export async function openCatalogProposal(
  command: CatalogCommand,
  conversationId: string,
): Promise<ProposalView | { clarify: string }> {
  if (command.type === "create_client" || command.type === "update_client") {
    return proposeFromParty(command, conversationId);
  }
  const scope = pendingInThread(conversationId);
  if (!scope) return { clarify: "Le fil est inconnu. Rien n’est enregistré." };
  const presented = presentCommand(command);
  await prisma.catalogProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  await prisma.catalogProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: command,
      ...stampProvenance("regle", presented.fields),
    },
  });
  revalidatePath("/");
  return { reply: presented.reply, proposal: { fields: presented.fields } };
}

export async function confirmCatalogProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const scope = pendingInThread(conversationId);
  if (!scope) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  const row = await prisma.catalogProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  const command = row.payload as CatalogCommand;
  const saved = await applyCatalogCommand(command);
  if (!saved.ok) return saved;
  await prisma.catalogProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  return saved;
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
    await prisma.catalogProposal.update({
      where: { id: catalog.id },
      data: { status: "rejetee", validatedAt: new Date() },
    });
    revalidatePath("/");
    return { reply: "Rien n’est enregistré. Reformulez la fiche si besoin." };
  }
  const draft = await currentProposal(scope.conversationId);
  return {
    reply:
      "La fiche n’est pas enregistrée. Indiquez ce qu’il faut changer, par exemple le téléphone, le pays ou la forme juridique.",
    proposal: draft ? { fields: proposalFields(draft) } : undefined,
  };
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

function choosePending(rows: Array<PendingCandidate | null>, conversationId: string): PendingCandidate | null {
  return selectablePending(rows.filter((row): row is PendingCandidate => row !== null), conversationId);
}
