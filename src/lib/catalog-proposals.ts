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
import { confirmCurrentProposal, currentProposal, proposeFromParty, type ProposalView } from "@/lib/client-proposals";
import { applyCatalogCommand } from "@/lib/catalog-store";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export async function openCatalogProposal(
  command: CatalogCommand,
): Promise<ProposalView | { clarify: string }> {
  if (command.type === "create_client" || command.type === "update_client") {
    return proposeFromParty(command);
  }
  const presented = presentCommand(command);
  await prisma.catalogProposal.updateMany({
    where: { status: "en_attente" },
    data: { status: "remplacee" },
  });
  await prisma.catalogProposal.create({
    data: { status: "en_attente", payload: command, ...stampProvenance("regle", presented.fields) },
  });
  revalidatePath("/");
  return { reply: presented.reply, proposal: { fields: presented.fields } };
}

export async function confirmCatalogProposal(): Promise<{ ok: boolean; summary: string }> {
  const row = await prisma.catalogProposal.findFirst({
    where: { status: "en_attente" },
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

export async function rejectLatestWrite(): Promise<{
  reply: string;
  proposal?: ProposalView["proposal"];
} | null> {
  const [client, catalog, contract, intervention] = await Promise.all([
    prisma.clientProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
    pendingContractProposal(),
    pendingInterventionProposal(),
  ]);
  if (!client && !catalog && !contract && !intervention) return null;
  const newest = latestOf([
    client ? { at: client.createdAt, kind: "client" as const } : null,
    catalog ? { at: catalog.createdAt, kind: "catalog" as const } : null,
    contract ? { at: contract.createdAt, kind: "contract" as const } : null,
    intervention ? { at: intervention.createdAt, kind: "intervention" as const } : null,
  ]);
  if (newest?.kind === "intervention") {
    const rejected = await rejectInterventionProposal();
    return rejected ? { reply: rejected.reply } : null;
  }
  if (newest?.kind === "contract") {
    const rejected = await rejectContractProposal();
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
  const draft = await currentProposal();
  return {
    reply:
      "La fiche n’est pas enregistrée. Indiquez ce qu’il faut changer, par exemple le téléphone, le pays ou la forme juridique.",
    proposal: draft ? { fields: proposalFields(draft) } : undefined,
  };
}

export async function confirmLatestWrite(): Promise<{ ok: boolean; summary: string }> {
  const [client, catalog, contract, intervention] = await Promise.all([
    prisma.clientProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
    pendingContractProposal(),
    pendingInterventionProposal(),
  ]);
  if (!client && !catalog && !contract && !intervention) {
    return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  }
  const newest = latestOf([
    client ? { at: client.createdAt, kind: "client" as const } : null,
    catalog ? { at: catalog.createdAt, kind: "catalog" as const } : null,
    contract ? { at: contract.createdAt, kind: "contract" as const } : null,
    intervention ? { at: intervention.createdAt, kind: "intervention" as const } : null,
  ]);
  return withChangeSource("assistant", () => {
    if (newest?.kind === "intervention") return confirmInterventionProposal();
    if (newest?.kind === "contract") return confirmContractProposal();
    if (newest?.kind === "catalog") return confirmCatalogProposal();
    return confirmCurrentProposal();
  });
}

function latestOf(
  rows: Array<{ at: Date; kind: "client" | "catalog" | "contract" | "intervention" } | null>,
): { at: Date; kind: "client" | "catalog" | "contract" | "intervention" } | null {
  return rows.reduce<{ at: Date; kind: "client" | "catalog" | "contract" | "intervention" } | null>((best, row) => {
    if (!row) return best;
    if (!best || row.at > best.at) return row;
    return best;
  }, null);
}
