import { nameKey, parseCatalogCommand } from "./catalog.ts";
import { classifyPendingTurn } from "./conversation-turn.ts";
import { decideFree } from "./intent-catalog.ts";
import { understandIntent } from "./knowledge.ts";
import { structuredPlanEligible } from "./structured-plan.ts";

export type SituationMentionKind =
  | "client"
  | "supplier"
  | "product"
  | "quantity"
  | "amount"
  | "document";

export type SituationReadingModelOutput = {
  mentions: {
    kind: SituationMentionKind;
    text: string;
  }[];
};

export type SituationMention = {
  kind: SituationMentionKind;
  text: string;
  start: number;
  end: number;
};

export type ProjectContext =
  | { state: "current"; projectId: string; projectName: string }
  | { state: "matched"; projectId: string; projectName: string }
  | { state: "ambiguous"; projectNames: string[] }
  | { state: "unresolved" };

export type KnownEntityKind = "client" | "supplier" | "product";

export type KnownEntity = {
  kind: KnownEntityKind;
  mentionText: string;
  name: string;
};

export type SituationReading = {
  source: {
    conversationId: string;
    inboxItemId: string | null;
    fileIds: string[];
    userText: string;
  };
  mentions: SituationMention[];
  mentionProvenance: { origin: "ollama"; model: string } | { origin: "none" };
  projectContext: ProjectContext;
  projectContextProvenance: "server-rule";
  knownEntities: KnownEntity[];
  knownEntityProvenance: "server-rule";
};

export type ProjectNameRow = { id: string; name: string };
export type DirectoryNameRow = { kind: KnownEntityKind; name: string };

export const SITUATION_RAW_LIMIT = 4_000;
const MENTION_MAX = 8;
const TEXT_MAX = 120;
const MIN_LENGTH = 20;
const MAX_LENGTH = 500;

const MENTION_KINDS = new Set<SituationMentionKind>([
  "client",
  "supplier",
  "product",
  "quantity",
  "amount",
  "document",
]);
const ROOT_KEYS = new Set(["mentions"]);
const MENTION_KEYS = new Set(["kind", "text"]);

const HEAD =
  /^(?:propose|envoie|fais|prepare|redige|dis|resume|enregistre|rattache|affecte|associe|mets|classe|compare|calcule|lis|peux-tu|pourrais-tu)\b/;
const QUESTION_HEAD =
  /^(?:liste|montre|affiche|cherche|recherche|explique|pourquoi|comment|combien|quels|quelles)\b/;
const OUTGOING_PROPOSE = /\b(?:je propose|on propose|nous proposons)\b/;
const INCOMING_RECEIVED = /\b(?:j'ai recu|nous avons recu|recu de|recu du)\b/;
const INCOMING_SENT = /\b(?:m'a envoyee?|m'ont envoyee?|nous a envoyee?|nous ont envoyee?)\b/;
const PROPOSE = /\bpropose(?:nt)?\b/;
const COMMERCIAL = /\b(?:devis|proposition|offre|chiffrage|tarif)\b/;
const AMOUNT =
  /\d[\d\s.,]*\s*(?:€|eur\b|euros?\b|\$|usd\b)|(?:€|\$)\s*\d/i;
const NEGATION = /\b(?:pas|jamais|aucun|rien)\b|\bne\b[\s\S]{0,40}\bplus\b|\bn['’][\s\S]{0,40}\bplus\b/;
const SCOPE =
  /\b(?:contrat|intervention|equipement|reclamation|retour|catalogue|facture|comptabilite)\b/;
const BLOCKED_TOPIC =
  /\b(?:paiement|reglement|virement|encaissement|commande|livraison|appel|rendez-vous)\b/;
const KNOWLEDGE = /\b(?:que sait|qui est)\b/;
const CREATE_VERB = /\b(?:ajoute|cree|creer|modifie|corrige|supprime|change)\b/;
const ASK = /\?|\best-ce que\b|\bqu'est-ce\b/;

export function situationModelGuide(): string {
  return [
    "Tu réponds par un seul objet JSON, sans texte autour.",
    "La seule clé est mentions.",
    "Chaque mention a exactement les clés kind et text.",
    "kind vaut client, supplier, product, quantity, amount ou document.",
    "text est un extrait exact de la demande, 120 caractères au plus.",
    "Au plus 8 mentions.",
    "N’envoie aucun identifiant, ni start, ni end.",
  ].join(" ");
}

export function situationReadingEligible(text: string): boolean {
  const source = text.trim();
  if (source.length < MIN_LENGTH || source.length > MAX_LENGTH) return false;
  const folded = fold(source);
  if (ASK.test(folded) || QUESTION_HEAD.test(folded)) return false;
  if (NEGATION.test(folded) || KNOWLEDGE.test(folded)) return false;
  if (HEAD.test(folded) || OUTGOING_PROPOSE.test(folded)) return false;
  if (BLOCKED_TOPIC.test(folded) || SCOPE.test(folded)) return false;
  if (/\bfiche\b/.test(folded) || /\bouvre\b/.test(folded) || CREATE_VERB.test(folded)) return false;
  const turn = classifyPendingTurn(source);
  if (turn === "confirm" || turn === "reject") return false;
  const intent = understandIntent(source);
  if (intent === "lookup" || intent === "directory" || intent === "change") return false;
  const free = decideFree(source);
  if (free.execution === "absente" && free.id) return false;
  if (structuredPlanEligible(source) || parseCatalogCommand(source)) return false;
  const incoming = INCOMING_RECEIVED.test(folded) || INCOMING_SENT.test(folded) || PROPOSE.test(folded);
  const commercial = COMMERCIAL.test(folded) || AMOUNT.test(source);
  return incoming && commercial;
}

/** Le gate n’est atteint qu’après les règles qui répondent déjà. Une correction l’empêche. */
export function situationReadingTurn(input: {
  correction: boolean;
  answeredDirectly: boolean;
  structuredPlanAnswered: boolean;
  deterministicSheet: boolean;
  text: string;
}): boolean {
  if (input.correction || input.answeredDirectly || input.structuredPlanAnswered || input.deterministicSheet) {
    return false;
  }
  return situationReadingEligible(input.text);
}

export function parseSituationModelOutput(raw: string): SituationReadingModelOutput | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > SITUATION_RAW_LIMIT) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !exactKeys(value, ROOT_KEYS) || !Array.isArray(value.mentions)) return null;
  if (value.mentions.length > MENTION_MAX) return null;
  const mentions: SituationReadingModelOutput["mentions"] = [];
  for (const item of value.mentions) {
    if (!isRecord(item) || !exactKeys(item, MENTION_KEYS)) return null;
    if (typeof item.kind !== "string" || !MENTION_KINDS.has(item.kind as SituationMentionKind)) return null;
    if (typeof item.text !== "string") return null;
    const text = item.text.trim();
    if (!text || text.length > TEXT_MAX) return null;
    mentions.push({ kind: item.kind as SituationMentionKind, text });
  }
  return { mentions };
}

export function anchorMentions(userText: string, output: SituationReadingModelOutput): SituationMention[] {
  const mentions: SituationMention[] = [];
  for (const item of output.mentions) {
    const start = userText.indexOf(item.text);
    if (start < 0) continue;
    if (item.kind === "amount" && !validAmount(item.text)) continue;
    if (item.kind === "quantity" && !/\d/.test(item.text)) continue;
    mentions.push({ kind: item.kind, text: item.text, start, end: start + item.text.length });
  }
  return mentions;
}

export function matchProjectContext(
  text: string,
  projects: ProjectNameRow[],
  pageProjectId: string,
): ProjectContext {
  const hay = nameKey(text);
  const groups = new Map<string, { name: string; ids: string[]; needle: string }>();
  for (const project of projects) {
    const needle = nameKey(project.name);
    if (!needle) continue;
    const current = groups.get(needle);
    if (current) {
      current.ids.push(project.id);
    } else {
      groups.set(needle, { name: project.name, ids: [project.id], needle });
    }
  }
  const hits = [...groups.values()].flatMap((group) => {
    const spans = occurrences(hay, group.needle);
    return spans.length ? [{ ...group, spans }] : [];
  });
  const kept = hits.filter((hit) => hit.spans.some((span) => !covered(span, hit.needle, hits)));
  const names = kept.map((hit) => hit.name);
  const severalRows = kept.some((hit) => hit.ids.length > 1);
  if (kept.length > 1 || severalRows) return { state: "ambiguous", projectNames: names };
  const only = kept[0];
  if (only && only.ids.length === 1 && only.ids[0]) {
    return { state: "matched", projectId: only.ids[0], projectName: only.name };
  }
  const page = pageProjectId ? projects.find((project) => project.id === pageProjectId) : undefined;
  if (page) return { state: "current", projectId: page.id, projectName: page.name };
  return { state: "unresolved" };
}

export function matchKnownEntities(mentions: SituationMention[], rows: DirectoryNameRow[]): KnownEntity[] {
  const found: KnownEntity[] = [];
  for (const mention of mentions) {
    const key = nameKey(mention.text);
    if (!key) continue;
    for (const row of rows) {
      if (nameKey(row.name) !== key) continue;
      if (found.some((item) => item.kind === row.kind && item.mentionText === mention.text && item.name === row.name)) {
        continue;
      }
      found.push({ kind: row.kind, mentionText: mention.text, name: row.name });
    }
  }
  return found;
}

export function buildSituationReading(input: {
  conversationId: string;
  inboxItemId: string | null;
  fileIds: string[];
  userText: string;
  projects: ProjectNameRow[];
  pageProjectId: string;
  modelOutput: SituationReadingModelOutput | null;
  model: string | null;
  directory: DirectoryNameRow[];
}): SituationReading {
  const mentions = input.modelOutput ? anchorMentions(input.userText, input.modelOutput) : [];
  const mentionProvenance =
    input.modelOutput && input.model
      ? ({ origin: "ollama", model: input.model } as const)
      : ({ origin: "none" } as const);
  return {
    source: {
      conversationId: input.conversationId,
      inboxItemId: input.inboxItemId,
      fileIds: input.fileIds,
      userText: input.userText,
    },
    mentions,
    mentionProvenance,
    projectContext: matchProjectContext(input.userText, input.projects, input.pageProjectId),
    projectContextProvenance: "server-rule",
    knownEntities: matchKnownEntities(mentions, input.directory),
    knownEntityProvenance: "server-rule",
  };
}

export function describeProjectContext(context: ProjectContext): string {
  if (context.state === "current") return `Dossier ouvert : ${context.projectName}`;
  if (context.state === "matched") return `Dossier nommé : ${context.projectName}`;
  if (context.state === "ambiguous") {
    if (context.projectNames.length === 1) {
      return `Plusieurs dossiers portent le nom ${context.projectNames[0] ?? ""}.`;
    }
    return `Noms complets présents : ${context.projectNames.join(", ")}.`;
  }
  return "Aucun rattachement déterministe.";
}

export function situationReply(reading: SituationReading, detailUnavailable: boolean): string {
  const lines = ["Lecture d’une situation reçue. Rien n’est enregistré.", describeProjectContext(reading.projectContext)];
  if (detailUnavailable) {
    lines.push("La lecture détaillée du contenu n’est pas disponible.");
  } else if (reading.mentions.length) {
    lines.push(`Mentions : ${reading.mentions.map((item) => item.text).join(", ")}.`);
  }
  if (reading.knownEntities.length) {
    lines.push(
      `Fiches connues : ${reading.knownEntities.map((item) => `${item.name} (${item.kind})`).join(", ")}.`,
    );
  }
  if (reading.mentionProvenance.origin === "ollama") {
    lines.push(
      `Les mentions viennent du modèle ${reading.mentionProvenance.model}. Le dossier et les fiches viennent d’une règle du serveur.`,
    );
  } else {
    lines.push("Le dossier vient d’une règle du serveur.");
  }
  return lines.join("\n");
}

export function readStoredSituation(value: unknown): SituationReading | null {
  if (!isRecord(value) || !("situation" in value)) return null;
  return storedReading(value.situation);
}

function storedReading(value: unknown): SituationReading | null {
  if (!isRecord(value)) return null;
  const source = value.source;
  const context = value.projectContext;
  if (!isRecord(source) || typeof source.userText !== "string" || typeof source.conversationId !== "string") return null;
  if (!isRecord(context) || typeof context.state !== "string") return null;
  const projectContext = storedContext(context);
  if (!projectContext) return null;
  const mentions = Array.isArray(value.mentions)
    ? value.mentions.flatMap((item) => {
        if (!isRecord(item) || typeof item.text !== "string" || typeof item.kind !== "string") return [];
        if (!MENTION_KINDS.has(item.kind as SituationMentionKind)) return [];
        if (typeof item.start !== "number" || typeof item.end !== "number") return [];
        return [{ kind: item.kind as SituationMentionKind, text: item.text, start: item.start, end: item.end }];
      })
    : [];
  const knownEntities: KnownEntity[] = Array.isArray(value.knownEntities)
    ? value.knownEntities.flatMap((item) => {
        if (!isRecord(item) || typeof item.name !== "string" || typeof item.mentionText !== "string") return [];
        const kind = knownKind(item.kind);
        if (!kind) return [];
        const entity: KnownEntity = { kind, mentionText: item.mentionText, name: item.name };
        return [entity];
      })
    : [];
  const provenance = value.mentionProvenance;
  const mentionProvenance =
    isRecord(provenance) && provenance.origin === "ollama" && typeof provenance.model === "string"
      ? ({ origin: "ollama", model: provenance.model } as const)
      : ({ origin: "none" } as const);
  return {
    source: {
      conversationId: source.conversationId,
      inboxItemId: typeof source.inboxItemId === "string" ? source.inboxItemId : null,
      fileIds: Array.isArray(source.fileIds) ? source.fileIds.filter((item): item is string => typeof item === "string") : [],
      userText: source.userText,
    },
    mentions,
    mentionProvenance,
    projectContext,
    projectContextProvenance: "server-rule",
    knownEntities,
    knownEntityProvenance: "server-rule",
  };
}

function knownKind(value: unknown): KnownEntityKind | null {
  if (value === "client" || value === "supplier" || value === "product") return value;
  return null;
}

function storedContext(value: Record<string, unknown>): ProjectContext | null {
  if (value.state === "unresolved") return { state: "unresolved" };
  if (value.state === "ambiguous" && Array.isArray(value.projectNames)) {
    return {
      state: "ambiguous",
      projectNames: value.projectNames.filter((item): item is string => typeof item === "string"),
    };
  }
  if ((value.state === "current" || value.state === "matched") && typeof value.projectId === "string" && typeof value.projectName === "string") {
    return { state: value.state, projectId: value.projectId, projectName: value.projectName };
  }
  return null;
}

function covered(
  span: { start: number; end: number },
  needle: string,
  hits: Array<{ needle: string; spans: Array<{ start: number; end: number }> }>,
): boolean {
  return hits.some(
    (hit) =>
      hit.needle.length > needle.length &&
      hit.spans.some((other) => span.start >= other.start && span.end <= other.end),
  );
}

function occurrences(hay: string, needle: string): Array<{ start: number; end: number }> {
  const useful = needle.replace(/[^0-9a-z]/g, "");
  if (useful.length < 3) return [];
  const found: Array<{ start: number; end: number }> = [];
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    const before = at === 0 ? "" : hay.charAt(at - 1);
    const after = hay.charAt(at + needle.length);
    if (!wordChar(before) && !wordChar(after)) found.push({ start: at, end: at + needle.length });
    from = at + 1;
  }
  return found;
}

function validAmount(text: string): boolean {
  return /\d/.test(text) && AMOUNT.test(text);
}

function fold(value: string): string {
  return value
    .replace(/[’‘´`]/g, "'")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function wordChar(value: string): boolean {
  return /[0-9a-z]/.test(value);
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
