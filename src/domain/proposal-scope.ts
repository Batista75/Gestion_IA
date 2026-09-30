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
