"use server";

import { revalidatePath } from "next/cache";
import { confirmDocumentProposal, dismissDocumentProposal } from "@/lib/document-proposals";

export type ProposalState = {
  message: string | null;
};

async function refresh() {
  for (const path of ["/", "/repertoire", "/clients", "/fournisseurs", "/produits"]) {
    revalidatePath(path);
  }
}

export async function confirmDocumentAction(id: string): Promise<ProposalState> {
  const result = await confirmDocumentProposal(id);
  await refresh();
  return { message: result.message };
}

export async function dismissDocumentAction(id: string): Promise<ProposalState> {
  const result = await dismissDocumentProposal(id);
  await refresh();
  return { message: result.message };
}
