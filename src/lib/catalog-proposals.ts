import { revalidatePath } from "next/cache";
import { presentCommand, type CatalogCommand } from "@/domain/catalog";
import { stampProvenance } from "@/domain/provenance";
import { proposalFields } from "@/domain/client-file";
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
  const [client, catalog] = await Promise.all([
    prisma.clientProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!client && !catalog) return null;
  const catalogFirst = Boolean(catalog && (!client || catalog.createdAt > client.createdAt));
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
  const [client, catalog] = await Promise.all([
    prisma.clientProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogProposal.findFirst({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!client && !catalog) {
    return { ok: false, summary: "Il n’y a pas de fiche en attente." };
  }
  const catalogFirst = Boolean(catalog && (!client || catalog.createdAt > client.createdAt));
  return withChangeSource("assistant", () =>
    catalogFirst ? confirmCatalogProposal() : confirmCurrentProposal(),
  );
}
