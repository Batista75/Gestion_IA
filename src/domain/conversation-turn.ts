import { nameKey } from "./catalog.ts";
import { understandIntent } from "./knowledge.ts";
import { addressSegments, addressValueSpans, structuredPlanEligible, structuredShape } from "./structured-plan.ts";

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
  const shape = structuredShape(text);
  if (shape === "supplier" || shape === "product" || shape === "service") return "new_intent";
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

export type FieldFocus = {
  kind: "draft" | "named";
  subject: string | null;
  value: string;
};

export type ProposalLife = {
  status: string;
  validatedAt: string | null;
};

/** Sépare le sujet d’une demande de champ et la valeur qui suit. */
export function readFieldFocus(text: string): FieldFocus | null {
  const raw = text.trim().replace(/[^\S\n]+/g, " ");
  if (!raw) return null;
  const introduced = raw.match(
    new RegExp(`^Pour\\s+([^,\\n]+?)\\s*,\\s*(?:le |la |l['’])?${FIELD}\\b\\s*${MARK}\\s+(.+)$`, "i"),
  );
  if (introduced) {
    const subject = cleanValue(introduced[1] ?? "");
    const value = cleanValue(introduced[2] ?? "");
    if (subject && !isGenericSubject(subject)) return { kind: "named", subject, value };
  }
  const pronoun = raw.match(new RegExp(`\\b(?:son|sa|ses)\\s+${FIELD}\\b(?:\\s*${MARK})?\\s*(.*)$`, "i"));
  if (pronoun) return { kind: "draft", subject: null, value: cleanValue(pronoun[1] ?? "") };
  const named = raw.match(new RegExp(`\\b${FIELD}\\b\\s+(?:de|du|des|d['’])\\s*(.+?)\\s+${MARK}\\s+(.+)$`, "i"));
  if (named) {
    const subject = cleanValue(named[1] ?? "");
    const value = cleanValue(named[2] ?? "");
    if (!subject || isGenericSubject(subject)) return { kind: "draft", subject: null, value };
    return { kind: "named", subject, value };
  }
  const positioned = readPositionedFocus(raw);
  if (positioned) return positioned;
  const supplied = raw.match(
    new RegExp(
      `\\b(?:ajoute\\w*|compl[eè]te\\w*)\\s+(?:(?:aussi|également|egalement|encore|avec)\\s+)?(?:l['’]|le\\s+|la\\s+)?${FIELD}\\b(?:\\s+avec)?\\s+(.+)$`,
      "i",
    ),
  );
  if (supplied) return { kind: "draft", subject: null, value: cleanValue(supplied[1] ?? "") };
  const bare = raw.match(new RegExp(`\\b${FIELD}\\b\\s*${MARK}\\s+(.+)$`, "i"));
  if (bare) return { kind: "draft", subject: null, value: cleanValue(bare[1] ?? "") };
  const verb = raw.match(
    new RegExp(
      `\\b(?:corrige\\w*|remplace\\w*|change\\w*)\\b[\\s\\S]{0,40}?\\b${FIELD}\\b(?:\\s+(?:de|du|des|d['’])\\s*(.+?))?\\s*${MARK}\\s+(.+)$`,
      "i",
    ),
  );
  if (verb) {
    const subject = cleanValue(verb[1] ?? "");
    const value = cleanValue(verb[2] ?? "");
    if (subject && !isGenericSubject(subject)) return { kind: "named", subject, value };
    return { kind: "draft", subject: null, value };
  }
  const placed = raw.match(/\b(?:mets|mettez)\s+(?:l['’]|le\s+|la\s+)?adresse\s+(.+)$/i);
  if (placed) return { kind: "draft", subject: null, value: cleanValue(placed[1] ?? "") };
  const rather = raw.match(/\bplut[oô]t\b\s+(.+)$/i);
  if (rather && hasStreet(rather[1] ?? "")) return { kind: "draft", subject: null, value: cleanValue(rather[1] ?? "") };
  return null;
}

/** La cible d’une mise à jour est le sujet. Un nom dans la valeur n’est pas une cible. */
export function resolveUpdateTarget(text: string, names: string[]): RecordTarget {
  const focus = readFieldFocus(text);
  if (focus?.kind === "draft") return { status: "none" };
  if (focus?.kind === "named") return resolveRecordTarget(focus.subject ?? "", names);
  return resolveRecordTarget(textWithoutStructuredValues(text), names);
}

/** Un sujet nommé qui ne correspond à aucune fiche. Le brouillon courant n’est pas repris. */
export function unresolvedNamedTarget(text: string, names: string[]): string | null {
  const focus = readFieldFocus(text);
  if (focus?.kind !== "named" || !focus.subject) return null;
  if (resolveUpdateTarget(text, names).status !== "none") return null;
  return `Je ne trouve pas ${focus.subject}. Rien n’a été modifié.`;
}

/** Une correction qui nomme une fiche en attente ne vise qu’elle. */
export function pendingNamedRevision(
  names: string[],
  text: string,
): { status: "revise"; name: string } | { status: "clarify"; names: string[] } | { status: "skip" } {
  const focus = readFieldFocus(text);
  if (focus?.kind !== "named") return { status: "skip" };
  const target = resolveRecordTarget(focus.subject ?? "", names);
  if (target.status === "one") return { status: "revise", name: target.name };
  if (target.status === "ambiguous") return { status: "clarify", names: target.names };
  return { status: "skip" };
}

/** Une correction sans nom, face à plusieurs fiches, ne choisit pas. */
export function pendingCorrectionDecision(names: string[], text: string): "revise" | "clarify" | "skip" {
  if (!revisesPendingDraft(classifyPendingTurn(text))) return "skip";
  if (names.length > 1) return "clarify";
  if (names.length === 1) return "revise";
  return "skip";
}

export function pendingDraftsClarification(names: string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  const head = clean.length === 2 ? "Deux" : String(clean.length);
  return `${head} fiches sont en attente : ${joinNames(clean)}. Précisez celle que vous souhaitez corriger. Rien n’a été modifié.`;
}

/** Un refus ne réécrit une proposition que si elle est encore en attente. */
export function rejectPendingProposal(row: ProposalLife, validatedAt: string): { row: ProposalLife; changed: boolean } {
  if (row.status !== "en_attente") return { row, changed: false };
  return { row: { status: "rejetee", validatedAt }, changed: true };
}

export function proposalCanBeConfirmed(status: string): boolean {
  return status === "en_attente";
}

/** Remplace la proposition révisée, ou celle du même nom exact. Les autres restent. */
export function proposalsReplacedBy(input: {
  replaceId: string | null;
  nextName: string;
  pending: Array<{ id: string; name: string }>;
}): string[] {
  const key = nameKey(input.nextName);
  const ids: string[] = [];
  if (input.replaceId) ids.push(input.replaceId);
  for (const row of input.pending) {
    if (ids.includes(row.id)) continue;
    if (key && nameKey(row.name) === key) ids.push(row.id);
  }
  return ids;
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
  const focus = readFieldFocus(text);
  if (focus?.kind === "named") return false;
  if (focus?.kind === "draft") return true;
  const folded = fold(text);
  if (namesAnotherParty(text)) return false;
  if (/\b(son|sa|ses)\b/.test(folded) && hasFieldWord(folded)) return true;
  if (/\b(corrig\w*|remplac\w*|mets?\b|mettez|change\w*)\b/.test(folded) && hasFieldWord(folded)) return true;
  if (/\bplutot\b/.test(folded) && (hasFieldWord(folded) || hasStreet(text))) return true;
  if (/\badresse\s+est\b/.test(folded)) return true;
  if (/\b(le\s+)?telephone\s+est\b/.test(folded) || /\btel\s+est\b/.test(folded)) return true;
  if (/\b(e-?mail|mail)\s+(est|par)\b/.test(folded)) return true;
  return false;
}

const FIELD = "(?:adresses?|t[eé]l[eé]phones?|t[eé]l|e-?mails?|courriels?|mails?)";
const MARK = "(?::|=|est|c['’]est|devient|par)";

function namesAnotherParty(text: string): boolean {
  return readFieldFocus(text)?.kind === "named";
}

const UPDATE_VERB = "(?:ajoute\\w*|compl[eè]te\\w*|change\\w*|corrige\\w*|remplace\\w*|mets|mettez)";
const UPDATE_FILLER = "(?:(?:aussi|également|egalement|encore|avec)\\s+)?";
const UPDATE_ARTICLE = "(?:l['’]|le\\s+|la\\s+)?";

/** `<verbe> <champ> <valeur> à <cible>` ou `<verbe> <champ> de <cible> <valeur>`. */
function readPositionedFocus(raw: string): FieldFocus | null {
  const head = raw.match(
    new RegExp(`\\b${UPDATE_VERB}\\s+${UPDATE_FILLER}${UPDATE_ARTICLE}${FIELD}\\b\\s*(.*)$`, "i"),
  );
  if (!head) return null;
  const tail = (head[1] ?? "").trim();
  if (!tail) return null;
  const trailing = tail.match(/^(.+?)\s+(?:à|a)\s+(.+)$/i);
  if (trailing) {
    const value = cleanValue(trailing[1] ?? "");
    const subject = cleanValue(trailing[2] ?? "");
    if (value && subject && isStructuredValue(value) && !isGenericSubject(subject)) {
      return { kind: "named", subject, value };
    }
  }
  const leading = tail.match(/^(?:de|du|des|d['’])\s+(.+)$/i);
  if (!leading) return null;
  const split = splitSubjectAndValue(leading[1] ?? "");
  if (!split) return null;
  if (isGenericSubject(split.subject)) return { kind: "draft", subject: null, value: split.value };
  return { kind: "named", subject: split.subject, value: split.value };
}

function splitSubjectAndValue(rest: string): { subject: string; value: string } | null {
  const patterns = [
    /^(.*?)(?:\s+avec\s+|\s*[:：=]\s*|\s+)(\+?\d(?:[\s./-]*\d){9,})$/i,
    /^(.*?)(?:\s+avec\s+|\s*[:：=]\s*|\s+)([^\s@]+@[^\s@]+\.[^\s@]+)$/i,
    /^(.*?)(?:\s+avec\s+|\s*[:：=]\s*|\s+)(\d{1,5}\s+\S.*)$/i,
  ];
  for (const pattern of patterns) {
    const match = rest.trim().match(pattern);
    if (!match) continue;
    const subject = cleanValue(match[1] ?? "");
    const value = cleanValue(match[2] ?? "");
    if (!subject || !isStructuredValue(value)) continue;
    return { subject, value };
  }
  return null;
}

function isStructuredValue(value: string): boolean {
  if (/^\+?\d(?:[\s./-]*\d){9,}$/.test(value)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  const spans = addressValueSpans(value);
  return spans.length === 1 && cleanValue(spans[0] ?? "") === cleanValue(value);
}

function isGenericSubject(subject: string): boolean {
  const folded = fold(subject).replace(/['’]/g, " ").replace(/\s+/g, " ").trim();
  return /^(?:le |la |ce |cette |son |sa |ses )?client$/.test(folded)
    || /^(?:le |la |ce |cette |son |sa |ses )?fiche(?: client)?$/.test(folded);
}

function cleanValue(value: string): string {
  return value.replace(/[.!?\s]+$/g, "").trim();
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function hasFieldWord(folded: string): boolean {
  return /\b(telephone|tel|adresse|e-?mail|mail|courriel)\b/.test(folded);
}

function hasStreet(text: string): boolean {
  return addressSegments(text).length > 0 || /\b\d{1,5}\s+(?:bis\s+|ter\s+)?(?:rue|avenue|boulevard|bd|chemin|impasse|place|allee|route)\b/i.test(text);
}

/** Retire l’adresse complète, le téléphone et l’e-mail avant une recherche de nom sur la phrase entière. */
function textWithoutStructuredValues(text: string): string {
  let next = text;
  for (const segment of addressValueSpans(text)) {
    if (segment) next = next.replace(segment, " ");
  }
  next = next.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, " ");
  next = next.replace(/\+?\d(?:[\s./-]*\d){9,}/g, " ");
  return next;
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
