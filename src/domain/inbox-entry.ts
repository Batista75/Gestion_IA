export type InboxStatus = "a_traiter" | "proposee" | "traitee" | "ignoree";

export type InboxProposalKind = "business" | "document";

export type InboxProposal = {
  kind: InboxProposalKind;
  status: string;
};

export type InboxClaim = "reclamer" | "accepter" | "refuser";

const INBOX_ID = /^[\w-]{8,80}$/;

export function createdInboxStatus(): InboxStatus {
  return "a_traiter";
}

export function readInboxItemId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return INBOX_ID.test(id) ? id : null;
}

export function inboxStatusLabel(status: string): string {
  if (status === "a_traiter") return "À traiter";
  if (status === "proposee") return "Proposée";
  if (status === "traitee") return "Traitée";
  if (status === "ignoree") return "Ignorée";
  return status;
}

/** Statut d’entrée. `ignoree` n’est jamais recalculé. */
export function inboxStatusFromProposals(current: string, proposals: InboxProposal[]): InboxStatus {
  if (current === "ignoree") return "ignoree";
  return derivedInboxStatus(proposals);
}

/** Reprendre une entrée ignorée. */
export function resumeInboxStatus(proposals: InboxProposal[]): "a_traiter" | "proposee" {
  return hasActive(proposals) ? "proposee" : "a_traiter";
}

/**
 * Écriture du recalcul seulement si la ligne porte encore le statut lu.
 * Un ignoree posé entre la lecture et l’écriture rend le résultat nul.
 * Le WHERE correspondant reste à PostgreSQL.
 */
export function inboxStatusWrite(readStatus: string, statusNow: string, nextStatus: string): string | null {
  if (statusNow !== readStatus) return null;
  if (nextStatus === readStatus) return null;
  return nextStatus;
}

export function countsAsInboxAttention(status: string): boolean {
  return status === "a_traiter" || status === "proposee";
}

export function inboxAttentionLabel(count: number): string | null {
  if (count < 1) return null;
  if (count === 1) return "1 entrée reste à traiter.";
  return `${count} entrées restent à traiter.`;
}

/**
 * null peut être réclamé pour le fil courant.
 * Le même fil est accepté. Un autre fil est refusé.
 * L’atomicité du passage de null au fil reste à PostgreSQL.
 */
export function inboxClaim(input: {
  exists: boolean;
  conversationId: string | null;
  currentConversationId: string;
}): InboxClaim {
  const current = input.currentConversationId.trim();
  if (!input.exists || current.length === 0) return "refuser";
  if (input.conversationId === null) return "reclamer";
  if (input.conversationId === current) return "accepter";
  return "refuser";
}

function derivedInboxStatus(proposals: InboxProposal[]): InboxStatus {
  if (hasActive(proposals)) return "proposee";
  if (proposals.some((proposal) => proposal.kind === "business" && proposal.status === "echec")) {
    return "proposee";
  }
  if (proposals.some((proposal) => proposal.status === "confirmee")) return "traitee";
  return "a_traiter";
}

function hasActive(proposals: InboxProposal[]): boolean {
  return proposals.some((proposal) => {
    if (proposal.kind === "business") return proposal.status === "en_attente" || proposal.status === "en_cours";
    return proposal.status === "en_attente";
  });
}
