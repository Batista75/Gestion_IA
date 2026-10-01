import type { BusinessPlan } from "./business-brief.ts";
import { planIsEmpty } from "./business-brief.ts";

export type ProposalKind =
  | "client"
  | "catalog"
  | "contract"
  | "intervention"
  | "equipment"
  | "purchase"
  | "supplierTerms"
  | "claim"
  | "returnRequest"
  | "businessPlan";

const PROPOSAL_KINDS: ProposalKind[] = [
  "client",
  "catalog",
  "contract",
  "intervention",
  "equipment",
  "purchase",
  "supplierTerms",
  "claim",
  "returnRequest",
  "businessPlan",
];

export type ProposalCard = {
  id?: string;
  type?: ProposalKind;
  fields: Array<{ label: string; value: string }>;
  confirmable?: boolean;
};

export type ProposalAction = {
  action: "confirm" | "reject";
  proposalId: string;
  proposalType: ProposalKind;
};

export type ProposalTarget = {
  id: string;
  type: ProposalKind;
  conversationId: string | null;
  status: string;
};

export const UNAVAILABLE_PROPOSAL =
  "Cette proposition n’est plus disponible ou ne peut pas être modifiée.";

export function isProposalKind(value: unknown): value is ProposalKind {
  return typeof value === "string" && PROPOSAL_KINDS.some((kind) => kind === value);
}

export function proposalCard(
  type: ProposalKind,
  id: string,
  fields: Array<{ label: string; value: string }>,
  confirmable?: boolean,
): ProposalCard {
  return confirmable === undefined ? { id, type, fields } : { id, type, fields, confirmable };
}

/** Boutons Confirmer et Rejeter : l’identifiant et le type sont requis. confirmable reste un drapeau d’affichage. */
export function cardMayAct(card: ProposalCard | null | undefined): boolean {
  return Boolean(card?.id && isProposalKind(card.type) && card.confirmable !== false);
}

export function readStoredProposalCard(value: unknown): ProposalCard | null {
  if (!value || typeof value !== "object" || !("fields" in value)) return null;
  const fields = (value as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;
  const rows = fields.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { label?: unknown; value?: unknown };
    return typeof row.label === "string" && typeof row.value === "string"
      ? [{ label: row.label, value: row.value }]
      : [];
  });
  if (rows.length === 0) return null;
  const source = value as { id?: unknown; type?: unknown; confirmable?: unknown };
  const card: ProposalCard = { fields: rows };
  if (typeof source.id === "string" && source.id && isProposalKind(source.type)) {
    card.id = source.id;
    card.type = source.type;
  }
  if (source.confirmable === false) card.confirmable = false;
  return card;
}

export function proposalActionGate(
  value: unknown,
): { kind: "absent" } | { kind: "invalid" } | { kind: "ready"; action: ProposalAction } {
  if (value == null) return { kind: "absent" };
  if (!value || typeof value !== "object") return { kind: "invalid" };
  const row = value as { action?: unknown; proposalId?: unknown; proposalType?: unknown };
  if (row.action !== "confirm" && row.action !== "reject") return { kind: "invalid" };
  if (typeof row.proposalId !== "string" || !row.proposalId.trim()) return { kind: "invalid" };
  if (!isProposalKind(row.proposalType)) return { kind: "invalid" };
  return {
    kind: "ready",
    action: { action: row.action, proposalId: row.proposalId.trim(), proposalType: row.proposalType },
  };
}

/**
 * Une action de carte est traitée avant un parcours suspendu et avant le texte libre.
 * Sans action, un parcours suspendu peut reprendre.
 */
export function assistantTurnKind(input: {
  proposalAction: ProposalAction | null;
  taskSuspended: boolean;
}): "structured" | "task" | "text" {
  if (input.proposalAction) return "structured";
  if (input.taskSuspended) return "task";
  return "text";
}

/** La ligne demandée, dans ce fil, encore en attente, du type annoncé. Sinon rien. */
export function selectProposalTarget(
  rows: ProposalTarget[],
  action: { proposalId: string; proposalType: ProposalKind },
  conversationId: string,
): ProposalTarget | null {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return (
    rows.find(
      (row) =>
        row.id === action.proposalId &&
        row.type === action.proposalType &&
        row.conversationId === scope.conversationId &&
        row.status === scope.status,
    ) ?? null
  );
}

export type PendingCandidate = {
  id: string;
  kind: ProposalKind;
  conversationId: string | null;
  status: string;
  createdAt: string;
};

export type BusinessPlanDecision = "attendre" | "executer" | "deja_execute" | "hors_fil";

export type PlanSettlement = {
  status: "confirmee" | "echec";
  validated: boolean;
};

/** Fil exploitable. Une chaîne vide n’ouvre aucun repli. */
export function threadKey(conversationId: string): string | null {
  const current = conversationId.trim();
  return current.length > 0 ? current : null;
}

/**
 * Lignes en attente de ce fil seulement.
 * null signifie : ne rien lire, ne rien remplacer.
 */
export function pendingInThread(
  conversationId: string,
): { conversationId: string; status: "en_attente" } | null {
  const current = threadKey(conversationId);
  if (!current) return null;
  return { conversationId: current, status: "en_attente" };
}

/**
 * Lien documentaire d’une proposition de plan.
 * Un remplacement legacy reprend l’entrée précédente.
 * Un plan préparé depuis une phrase, sans dépôt, reste sans entrée.
 */
export function planInboxLink(
  requested: string | null,
  previous: string | null,
  inheritInboxItem: boolean,
): string | null {
  if (requested) return requested;
  if (!inheritInboxItem) return null;
  return previous;
}

/** La plus récente du fil. Une ligne sans fil, ou d’un autre fil, n’est pas retenue. */
export function selectablePending(
  rows: PendingCandidate[],
  conversationId: string,
): PendingCandidate | null {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  const matches = rows.filter(
    (row) => row.status === scope.status && row.conversationId === scope.conversationId,
  );
  matches.sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0));
  return matches[0] ?? null;
}

/**
 * Un plan n’est appliqué qu’une fois, après un oui, et seulement dans son fil.
 * confirmee, echec et en_cours bloquent une seconde exécution.
 * Une ligne sans fil ne passe pas.
 */
export function businessPlanDecision(input: {
  status: string;
  conversationId: string | null;
  currentConversationId: string;
  explicitConfirmation: boolean;
}): BusinessPlanDecision {
  if (input.status === "confirmee" || input.status === "echec" || input.status === "en_cours") {
    return "deja_execute";
  }
  if (!input.explicitConfirmation) return "attendre";
  const scope = pendingInThread(input.currentConversationId);
  if (!scope || input.conversationId !== scope.conversationId || input.status !== "en_attente") {
    return "hors_fil";
  }
  return "executer";
}

/** Après un claim réussi. Un échec ne revient pas à en_attente. */
export function settleBusinessPlan(outcome: "succes" | "echec"): PlanSettlement {
  if (outcome === "succes") return { status: "confirmee", validated: true };
  return { status: "echec", validated: false };
}

export type ClaimedOutcome<T> =
  | { status: "lost" }
  | { status: "confirmed"; value: T }
  | { status: "failed"; value: T }
  | { status: "failed"; error: unknown };

/**
 * Un seul claim gagne : en_attente, puis en_cours, puis l’écriture.
 * Le perdant n’écrit pas. Une erreur passe la ligne à echec, sans retour à en_attente.
 */
export async function runClaimedConfirmation<T>(input: {
  claim: () => Promise<boolean>;
  write: () => Promise<T>;
  succeeded: (value: T) => boolean;
  markConfirmed: () => Promise<void>;
  markFailed: () => Promise<void>;
}): Promise<ClaimedOutcome<T>> {
  if (!(await input.claim())) return { status: "lost" };
  try {
    const value = await input.write();
    if (!input.succeeded(value)) {
      await input.markFailed();
      return { status: "failed", value };
    }
    await input.markConfirmed();
    return { status: "confirmed", value };
  } catch (error) {
    await input.markFailed();
    return { status: "failed", error };
  }
}

/** Filet de test : le passage en_attente → en_cours est synchrone, donc un seul gagnant. */
export function createProposalLedger(status = "en_attente") {
  let current = status;
  let writes = 0;
  let history = 0;
  return {
    status: () => current,
    writes: () => writes,
    history: () => history,
    claim: async () => {
      if (current !== "en_attente") return false;
      current = "en_cours";
      return true;
    },
    reject: async () => {
      if (current !== "en_attente") return false;
      current = "rejetee";
      return true;
    },
    write: async () => {
      await Promise.resolve();
      writes += 1;
      history += 1;
      return { ok: true as const };
    },
    markConfirmed: async () => {
      if (current === "en_cours") current = "confirmee";
    },
    markFailed: async () => {
      if (current === "en_cours") current = "echec";
    },
  };
}

/** Texte du bouton, ou le texte libre déjà reconnu. */
export function structuredButtonTurn(text: string): "confirm" | "reject" | null {
  const value = text.trim();
  if (value === "Confirmer cette proposition." || /^je confirme\b/i.test(value)) return "confirm";
  if (value === "Rejeter cette proposition." || /^rejette\b/i.test(value)) return "reject";
  return null;
}

export function proposalFollowUpState(input: {
  latest: boolean;
  userText: string | null;
  assistantSource: string | null;
}): "a_confirmer" | "confirmee" | "sans_suite" {
  if (input.latest) return "a_confirmer";
  const turn = input.userText ? structuredButtonTurn(input.userText) : null;
  if (turn === "confirm" && input.assistantSource === "action") return "confirmee";
  return "sans_suite";
}

const PIECE_ID = /^[\w-]{8,80}$/;

/** Identifiants de StoredFile. Huit au plus, sans texte de pièce. */
export function readPieceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!PIECE_ID.test(id) || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length === 8) break;
  }
  return ids;
}

export function readStoredPlan(value: unknown): { plan: BusinessPlan; fileIds: string[] } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { plan?: unknown; fileIds?: unknown };
  const source = row.plan && typeof row.plan === "object" ? row.plan : row;
  const body = source as Partial<BusinessPlan>;
  if (!Array.isArray(body.clients) || !Array.isArray(body.articles) || !Array.isArray(body.projects) || !Array.isArray(body.quotes)) {
    return null;
  }
  const plan: BusinessPlan = {
    clients: body.clients,
    articles: body.articles,
    projects: body.projects,
    quotes: body.quotes,
  };
  if (planIsEmpty(plan)) return null;
  return { plan, fileIds: readPieceIds(row.fileIds) };
}

/** Texte de la carte. Les montants sont ceux déjà lus, sans calcul. */
export function presentBusinessPlan(plan: BusinessPlan): {
  reply: string;
  fields: Array<{ label: string; value: string }>;
} {
  const fields: Array<{ label: string; value: string }> = [];
  for (const client of plan.clients) {
    if (client.name.trim()) fields.push({ label: "Client", value: client.name.trim() });
  }
  for (const article of plan.articles) {
    const name = article.name.trim();
    if (!name) continue;
    const price = [article.statedPrice.trim(), article.currency.trim()].filter(Boolean).join(" ");
    fields.push({
      label: article.kind === "service" ? "Service" : "Article",
      value: price ? `${name} — ${price}` : name,
    });
  }
  for (const project of plan.projects) {
    const name = project.name.trim();
    if (!name) continue;
    const client = project.primaryClient.trim();
    const budget = project.budgetStated.trim();
    fields.push({
      label: "Projet",
      value: [name, client ? `pour ${client}` : "", budget].filter(Boolean).join(" "),
    });
  }
  for (const quote of plan.quotes) {
    const total = quote.statedTotalTtc.trim() || quote.statedTotalHt.trim();
    const label = [quote.reference.trim() || quote.clientName.trim(), total, quote.currency.trim()]
      .filter(Boolean)
      .join(" — ");
    if (label) fields.push({ label: "Devis", value: label });
  }
  const reply = [
    "Proposition à confirmer. Rien n’est enregistré.",
    ...fields.map((field) => `${field.label} : ${field.value}.`),
    "Confirmez pour enregistrer ces éléments.",
  ].join("\n");
  return { reply, fields };
}
