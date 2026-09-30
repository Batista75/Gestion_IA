import { nameKey } from "./catalog.ts";
import { understandIntent } from "./knowledge.ts";
import { structuredPlanEligible } from "./structured-plan.ts";

export type PendingTurn = "confirm" | "reject" | "correction" | "new_intent" | "unknown";

export type RecordTarget =
  | { status: "none" }
  | { status: "one"; name: string }
  | { status: "ambiguous"; names: string[] };

export const PENDING_TURN_CLARIFICATION =
  "Je n’ai pas compris si vous souhaitez corriger la fiche, la confirmer, l’annuler ou faire une nouvelle demande.";

const CONFIRM =
  /^(oui|oui je confirme|ok|okay|d accord|dac|c est bon|c est ok|c est valide|confirme|je confirme|enregistrer|enregistre|valide|je valide|parfait|yes)$/;
const REJECT = /^(non|non annule|no|annule|annuler|rejette|je rejette|pas ca|pas bon)$/;

export function classifyPendingTurn(text: string): PendingTurn {
  const normalized = normalizeTurn(text);
  if (!normalized) return "unknown";
  if (CONFIRM.test(normalized)) return "confirm";
  if (REJECT.test(normalized)) return "reject";
  if (isDraftCorrection(text)) return "correction";
  if (/^(oui|non)\b/.test(normalized)) return "unknown";
  if (isIndependentIntent(text)) return "new_intent";
  return "unknown";
}

export function revisesPendingDraft(turn: PendingTurn): boolean {
  return turn === "correction";
}

/** Une confirmation ou un refus vise la proposition dès qu’une proposition attend. */
export function confirmationBelongsToProposal(text: string, proposalPending: boolean): boolean {
  if (!proposalPending) return false;
  const turn = classifyPendingTurn(text);
  return turn === "confirm" || turn === "reject";
}

/**
 * Le bouton Confirmer de la clarification n’apparaît que si la fiche affichée
 * est la seule proposition en attente du fil.
 */
export function clarificationMayConfirm(displayedId: string | null, pendingIds: string[]): boolean {
  if (!displayedId) return false;
  if (pendingIds.length !== 1) return false;
  return pendingIds[0] === displayedId;
}

export function resolveRecordTarget(text: string, names: string[]): RecordTarget {
  const folded = fold(text);
  const whole = nameKey(text.replace(/[.!?,:;]+$/g, ""));
  const exact = names.filter((name) => nameKey(name) === whole);
  if (exact.length === 1) return { status: "one", name: exact[0] ?? "" };
  const hits: NameSpan[] = [];
  for (const name of names) {
    for (const span of nameSpans(folded, fold(name))) {
      hits.push({ name, start: span.start, end: span.end });
    }
  }
  const kept = hits.filter(
    (hit) =>
      !hits.some(
        (other) =>
          other.name !== hit.name &&
          other.start <= hit.start &&
          other.end >= hit.end &&
          other.end - other.start > hit.end - hit.start,
      ),
  );
  const chosen: string[] = [];
  for (const hit of kept) {
    if (!chosen.includes(hit.name)) chosen.push(hit.name);
  }
  if (chosen.length === 0) return { status: "none" };
  if (chosen.length === 1) return { status: "one", name: chosen[0] ?? "" };
  return { status: "ambiguous", names: chosen };
}

export function storedClientForDraft(draftName: string, names: string[]): string | null {
  const key = nameKey(draftName);
  if (!key) return null;
  return names.find((name) => nameKey(name) === key) ?? null;
}

function isIndependentIntent(text: string): boolean {
  if (structuredPlanEligible(text)) return true;
  const intent = understandIntent(text);
  if (intent === "lookup" || intent === "directory") return true;
  if (namesAnotherParty(fold(text))) return true;
  return /^(montre|liste|affiche|quels|quelles)\b/i.test(text.trim());
}

function isDraftCorrection(text: string): boolean {
  const folded = fold(text);
  if (namesAnotherParty(folded)) return false;
  if (/\b(son|sa|ses)\b/.test(folded) && hasFieldWord(folded)) return true;
  if (/\b(corrig\w*|remplac\w*|mets?\b|mettez|change\w*)\b/.test(folded) && hasFieldWord(folded)) return true;
  if (/\bplutot\b/.test(folded) && (hasFieldWord(folded) || hasStreet(text))) return true;
  if (/\badresse\s+est\b/.test(folded)) return true;
  if (/\b(le\s+)?telephone\s+est\b/.test(folded) || /\btel\s+est\b/.test(folded)) return true;
  if (/\b(e-?mail|mail)\s+(est|par)\b/.test(folded)) return true;
  return false;
}

function namesAnotherParty(folded: string): boolean {
  return /\b(?:telephone|tel|adresse|e-?mail|mail)\b[^.]{0,40}\b(?:de|du|d')\s+(?!son\b|sa\b|ses\b)/.test(folded);
}

function hasFieldWord(folded: string): boolean {
  return /\b(telephone|tel|adresse|e-?mail|mail|courriel)\b/.test(folded);
}

function hasStreet(text: string): boolean {
  return /\b\d{1,5}\s+(?:bis\s+|ter\s+)?(?:rue|avenue|boulevard|bd|chemin|impasse|place|allee|route)\b/i.test(text);
}

type NameSpan = { name: string; start: number; end: number };

function nameSpans(foldedText: string, foldedName: string): Array<{ start: number; end: number }> {
  if (foldedName.length < 2) return [];
  const escaped = foldedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, "g");
  const spans: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null = pattern.exec(foldedText);
  while (match) {
    const lead = match[1] ?? "";
    const body = match[2] ?? "";
    const start = match.index + lead.length;
    spans.push({ start, end: start + body.length });
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    match = pattern.exec(foldedText);
  }
  return spans;
}

function normalizeTurn(text: string): string {
  return fold(text)
    .replace(/['’]/g, " ")
    .replace(/[.!…]+$/g, "")
    .replace(/[,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'");
}
