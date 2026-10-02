import { nameKey } from "./catalog.ts";
import { readStoredSituation, type ProjectContext, type SituationMention, type SituationReading } from "./situation-reading.ts";

export const GAP_MAX = 24;

export type ModelHint = "client" | "supplier" | "product";
export type Family = "client" | "supplier" | "product";
export type EntityType = "client" | "supplier" | "product" | "service";
export type EntityView = "actor" | "item" | null;

export type BusinessIssueReason =
  | "unknown_entity"
  | "duplicate_name"
  | "cross_family_ambiguity"
  | "role_conflict"
  | "unlinked_quantity"
  | "unlinked_amount"
  | "relation_not_deterministic"
  | "repeated_anchor"
  | "overlapping_anchor"
  | "model_hint_ambiguity";

export type EntityCandidate = {
  family: Family;
  entityType: EntityType;
  entityId: string;
  entityName: string;
};

export type EntityResolution =
  | {
      state: "resolved";
      family: Family;
      entityType: EntityType;
      entityId: string;
      entityName: string;
      conflict: boolean;
    }
  | {
      state: "ambiguous";
      scope: "same_family" | "cross_family";
      candidates: EntityCandidate[];
    }
  | { state: "unresolved" };

export type BusinessEntityMention = {
  mentionText: string;
  start: number;
  end: number;
  modelHints: ModelHint[];
  resolution: EntityResolution;
  view: EntityView;
};

export type AnchorRef = { start: number; end: number };

export type BusinessRelation = {
  kind: "quantity_for_item" | "amount_for_item";
  valueAnchor: AnchorRef;
  entityAnchor: AnchorRef;
};

export type BusinessEventKind =
  | "quote_received"
  | "offer_received"
  | "price_received"
  | "commercial_proposal"
  | "unknown";

export type BusinessContext = {
  source: SituationReading["source"];
  projectContext: ProjectContext;
  event: { kind: BusinessEventKind; evidenceText: string | null };
  entities: BusinessEntityMention[];
  quantities: { text: string; start: number; end: number }[];
  amounts: { text: string; start: number; end: number }[];
  relations: BusinessRelation[];
  documents: { kind: "quote" | "offer" | "proposal" | "price"; mentionText: string }[];
  attachments: { fileIds: string[]; contentRead: false };
  issues: { reason: BusinessIssueReason; mentionText?: string; detail?: string }[];
  provenance: {
    mentions: { origin: "ollama"; model: string } | { origin: "none" };
    event: "server-rule";
    documents: "server-rule";
    resolution: "server-rule";
    projectContext: "server-rule";
  };
};

export type BusinessDirectoryRow = {
  id: string;
  name: string;
  table: Family;
  productKind?: string | null;
};

type Issue = BusinessContext["issues"][number];
type Span = { text: string; start: number; end: number; linkable: boolean };

const HINTS: ModelHint[] = ["client", "supplier", "product"];
const FAMILIES: Family[] = ["client", "supplier", "product"];
const EVENT_KINDS: BusinessEventKind[] = [
  "quote_received",
  "offer_received",
  "price_received",
  "commercial_proposal",
  "unknown",
];
const DOCUMENT_KINDS = ["quote", "offer", "proposal", "price"] as const;
const REASONS: BusinessIssueReason[] = [
  "unknown_entity",
  "duplicate_name",
  "cross_family_ambiguity",
  "role_conflict",
  "unlinked_quantity",
  "unlinked_amount",
  "relation_not_deterministic",
  "repeated_anchor",
  "overlapping_anchor",
  "model_hint_ambiguity",
];

const LEMMAS: Array<{ lemma: string; document: "quote" | "offer" | "proposal" | "price"; event: BusinessEventKind }> = [
  { lemma: "devis", document: "quote", event: "quote_received" },
  { lemma: "offre", document: "offer", event: "offer_received" },
  { lemma: "proposition", document: "proposal", event: "commercial_proposal" },
  { lemma: "chiffrage", document: "proposal", event: "commercial_proposal" },
  { lemma: "tarif", document: "price", event: "price_received" },
];

const INCOMING =
  /\b(?:j'ai recu|nous avons recu|recu de|recu du|m'a envoyee?|m'ont envoyee?|nous a envoyee?|nous ont envoyee?)\b/;
const PROPOSE = /\bpropose(?:nt)?\b/;

export function buildBusinessContext(input: {
  reading: SituationReading;
  rows: BusinessDirectoryRow[];
}): BusinessContext {
  const reading = input.reading;
  const text = reading.source.userText;
  const mentions = reading.mentions;
  const lexical = readLexical(text);
  const base: BusinessContext = {
    source: reading.source,
    projectContext: reading.projectContext,
    event: lexical.event,
    entities: [],
    quantities: [],
    amounts: [],
    relations: [],
    documents: lexical.documents,
    attachments: { fileIds: reading.source.fileIds.slice(), contentRead: false },
    issues: [],
    provenance: {
      mentions: reading.mentionProvenance,
      event: "server-rule",
      documents: "server-rule",
      resolution: "server-rule",
      projectContext: "server-rule",
    },
  };
  if (mentions.length === 0) return base;

  const issues: Issue[] = [];
  const blocked = anchorBlocks(text, mentions);
  for (const mention of mentions) {
    const block = blocked.get(keyOf(mention));
    if (!block) continue;
    if (block.repeated) pushIssue(issues, "repeated_anchor", mention.text);
    if (block.overlap) pushIssue(issues, "overlapping_anchor", mention.text);
  }

  const entities = resolveEntities(mentions, input.rows, reading.projectContext, issues);
  const quantities = valueSpans(mentions, "quantity", text, blocked);
  const amounts = valueSpans(mentions, "amount", text, blocked);
  const targets = entities.filter((entity) => isLinkTarget(entity, blocked));
  const relations: BusinessRelation[] = [];

  for (const quantity of quantities) {
    if (!quantity.linkable) continue;
    const pairs = admissiblePairs(text, mentions, quantity, targets);
    if (pairs.length === 1) {
      const target = pairs[0];
      if (target) relations.push(relation("quantity_for_item", quantity, target));
    } else if (pairs.length === 0) {
      pushIssue(issues, "unlinked_quantity", quantity.text);
    } else {
      pushIssue(issues, "relation_not_deterministic", quantity.text);
    }
  }

  linkAmounts(text, mentions, amounts, targets, relations, issues);

  return {
    ...base,
    entities,
    quantities: quantities.map(plainSpan),
    amounts: amounts.map(plainSpan),
    relations,
    issues,
  };
}

export function readStoredBusinessContext(value: unknown): BusinessContext | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("situation") || !keys.includes("businessContext")) return null;
  if (!readStoredSituation(value)) return null;
  return storedContext(value.businessContext);
}

function resolveEntities(
  mentions: SituationMention[],
  rows: BusinessDirectoryRow[],
  project: ProjectContext,
  issues: Issue[],
): BusinessEntityMention[] {
  const groups = new Map<string, SituationMention[]>();
  for (const mention of mentions) {
    if (!isHint(mention.kind)) continue;
    const id = keyOf(mention);
    const current = groups.get(id);
    if (current) current.push(mention);
    else groups.set(id, [mention]);
  }
  const entities: BusinessEntityMention[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    if (projectNames(project).some((name) => nameKey(name) === nameKey(first.text))) continue;
    const modelHints = uniqueHints(group.map((item) => item.kind as ModelHint));
    if (modelHints.length > 1) pushIssue(issues, "model_hint_ambiguity", first.text);
    const found = rows.filter((row) => nameKey(row.name) === nameKey(first.text) && row.id.trim());
    const resolution = resolveRows(found, modelHints);
    if (resolution.state === "unresolved") pushIssue(issues, "unknown_entity", first.text);
    if (resolution.state === "ambiguous" && resolution.scope === "cross_family") {
      pushIssue(issues, "cross_family_ambiguity", first.text);
    }
    if (resolution.state === "ambiguous" && resolution.scope === "same_family") {
      pushIssue(issues, "duplicate_name", first.text);
    }
    if (resolution.state === "resolved" && resolution.conflict) pushIssue(issues, "role_conflict", first.text);
    entities.push({
      mentionText: first.text,
      start: first.start,
      end: first.end,
      modelHints,
      resolution,
      view: viewOf(resolution, modelHints),
    });
  }
  return entities;
}

function resolveRows(rows: BusinessDirectoryRow[], hints: ModelHint[]): EntityResolution {
  const candidates = rows.map(candidateOf).sort(byCandidate);
  const families = uniqueFamilies(candidates.map((item) => item.family));
  if (candidates.length === 0) return { state: "unresolved" };
  if (families.length > 1) return { state: "ambiguous", scope: "cross_family", candidates };
  if (candidates.length > 1) return { state: "ambiguous", scope: "same_family", candidates };
  const only = candidates[0];
  if (!only) return { state: "unresolved" };
  const hint = hints.length === 1 ? hints[0] : null;
  return {
    state: "resolved",
    family: only.family,
    entityType: only.entityType,
    entityId: only.entityId,
    entityName: only.entityName,
    conflict: hint !== null && hint !== only.family,
  };
}

function viewOf(resolution: EntityResolution, hints: ModelHint[]): EntityView {
  if (resolution.state === "ambiguous") {
    if (resolution.scope === "cross_family") return null;
    const family = resolution.candidates[0]?.family;
    return family === "product" ? "item" : family ? "actor" : null;
  }
  if (resolution.state === "resolved") return resolution.family === "product" ? "item" : "actor";
  if (hints.length !== 1) return null;
  return hints[0] === "product" ? "item" : "actor";
}

function isLinkTarget(
  entity: BusinessEntityMention,
  blocked: Map<string, { repeated: boolean; overlap: boolean }>,
): boolean {
  const block = blocked.get(keyOf(entity));
  if (!block || block.repeated || block.overlap) return false;
  if (entity.modelHints.length !== 1) return false;
  if (entity.resolution.state === "unresolved") return entity.modelHints[0] === "product";
  return entity.resolution.state === "resolved" && entity.resolution.family === "product";
}

function linkAmounts(
  text: string,
  mentions: SituationMention[],
  amounts: Span[],
  targets: BusinessEntityMention[],
  relations: BusinessRelation[],
  issues: Issue[],
): void {
  const amountAnchors = distinctSpans(mentions.filter((item) => item.kind === "amount"));
  for (const amount of amounts) {
    if (!amount.linkable) continue;
    const pairs = admissiblePairs(text, mentions, amount, targets);
    const left = region(amountAnchors, amount, "left", text.length);
    const right = region(amountAnchors, amount, "right", text.length);
    const leftTargets = targetsInside(targets, left);
    const rightTargets = targetsInside(targets, right);
    if (leftTargets.length > 1 || (leftTargets.length === 0 && rightTargets.length > 1)) {
      pushIssue(issues, "relation_not_deterministic", amount.text);
      continue;
    }
    const segment = leftTargets.length === 1 ? leftTargets[0] : rightTargets.length === 1 ? rightTargets[0] : null;
    const retained = leftTargets.length === 1 ? left : rightTargets.length === 1 ? right : null;
    if (retained && nakedDigit(text, retained.start, retained.end, mentions)) {
      pushIssue(issues, "relation_not_deterministic", amount.text);
      continue;
    }
    const agreed = segment && pairs.length === 1 && pairs[0] && sameAnchor(pairs[0], segment) ? segment : null;
    if (agreed) {
      relations.push(relation("amount_for_item", amount, agreed));
      continue;
    }
    if (pairs.length === 0) pushIssue(issues, "unlinked_amount", amount.text);
    else pushIssue(issues, "relation_not_deterministic", amount.text);
  }
}

function admissiblePairs(
  text: string,
  mentions: SituationMention[],
  value: Span,
  targets: BusinessEntityMention[],
): BusinessEntityMention[] {
  return targets.filter((target) => intervalAdmissible(text, mentions, value, target));
}

function intervalAdmissible(
  text: string,
  mentions: SituationMention[],
  value: Span,
  target: BusinessEntityMention,
): boolean {
  const gap = openGap(value, target);
  if (!gap) return false;
  if (gap.end - gap.start > GAP_MAX) return false;
  const slice = text.slice(gap.start, gap.end);
  if (/\d/.test(slice) || /[,;:]/.test(slice)) return false;
  if (/\b(?:et|ou|puis)\b/.test(fold(slice))) return false;
  return !mentions.some((mention) => {
    if (sameAnchor(mention, value) || sameAnchor(mention, target)) return false;
    return mention.start < gap.end && mention.end > gap.start;
  });
}

function openGap(left: AnchorRef, right: AnchorRef): AnchorRef | null {
  if (left.end <= right.start) return { start: left.end, end: right.start };
  if (right.end <= left.start) return { start: right.end, end: left.start };
  return null;
}

function region(
  amounts: AnchorRef[],
  current: AnchorRef,
  side: "left" | "right",
  length: number,
): AnchorRef {
  if (side === "left") {
    let edge = 0;
    for (const amount of amounts) {
      if (amount.end <= current.start && amount.end >= edge && !sameAnchor(amount, current)) edge = amount.end;
    }
    return { start: edge, end: current.start };
  }
  let edge = length;
  for (const amount of amounts) {
    if (amount.start >= current.end && amount.start <= edge && !sameAnchor(amount, current)) edge = amount.start;
  }
  return { start: current.end, end: edge };
}

function targetsInside(targets: BusinessEntityMention[], span: AnchorRef): BusinessEntityMention[] {
  return targets.filter((target) => target.start >= span.start && target.end <= span.end);
}

function nakedDigit(text: string, from: number, to: number, mentions: SituationMention[]): boolean {
  for (let index = from; index < to; index += 1) {
    if (!/\d/.test(text.charAt(index))) continue;
    const covered = mentions.some((mention) => index >= mention.start && index < mention.end);
    if (!covered) return true;
  }
  return false;
}

function anchorBlocks(
  text: string,
  mentions: SituationMention[],
): Map<string, { repeated: boolean; overlap: boolean }> {
  const result = new Map<string, { repeated: boolean; overlap: boolean }>();
  for (const mention of mentions) {
    const id = keyOf(mention);
    if (result.has(id)) continue;
    const count = countOf(text, mention.text);
    const aligned = text.slice(mention.start, mention.end) === mention.text && text.indexOf(mention.text) === mention.start;
    const repeated = count !== 1 || !aligned;
    const overlap = mentions.some(
      (other) => other.text !== mention.text && mention.start < other.end && other.start < mention.end,
    );
    result.set(id, { repeated, overlap });
  }
  return result;
}

function valueSpans(
  mentions: SituationMention[],
  kind: "quantity" | "amount",
  text: string,
  blocked: Map<string, { repeated: boolean; overlap: boolean }>,
): Span[] {
  const seen = new Set<string>();
  const spans: Span[] = [];
  for (const mention of mentions) {
    if (mention.kind !== kind) continue;
    const id = keyOf(mention);
    if (seen.has(id)) continue;
    seen.add(id);
    const block = blocked.get(id);
    const slice = text.slice(mention.start, mention.end);
    spans.push({
      text: slice === mention.text ? mention.text : slice,
      start: mention.start,
      end: mention.end,
      linkable: Boolean(block && !block.repeated && !block.overlap && slice === mention.text),
    });
  }
  return spans;
}

function readLexical(text: string): {
  event: BusinessContext["event"];
  documents: BusinessContext["documents"];
} {
  const folded = foldMap(text);
  const found: Array<{ lemma: (typeof LEMMAS)[number]; start: number; end: number }> = [];
  for (const lemma of LEMMAS) {
    const at = wordAt(folded.folded, lemma.lemma);
    if (!at) continue;
    found.push({ lemma, start: folded.toOriginal[at.start] ?? 0, end: (folded.toOriginal[at.end - 1] ?? at.end - 1) + 1 });
  }
  found.sort((left, right) => left.start - right.start);
  const documents = found.map((item) => ({
    kind: item.lemma.document,
    mentionText: text.slice(item.start, item.end),
  }));
  const incoming = INCOMING.test(folded.folded);
  const verb = wordAt(folded.folded, PROPOSE);
  const verbSlice = verb
    ? text.slice(folded.toOriginal[verb.start] ?? 0, (folded.toOriginal[verb.end - 1] ?? verb.end - 1) + 1)
    : null;
  if (found.length >= 2) return { event: { kind: "unknown", evidenceText: null }, documents };
  const only = found[0];
  if (only && incoming) {
    return { event: { kind: only.lemma.event, evidenceText: text.slice(only.start, only.end) }, documents };
  }
  if (!only && verbSlice) return { event: { kind: "commercial_proposal", evidenceText: verbSlice }, documents };
  if (only && !incoming && verbSlice) return { event: { kind: "commercial_proposal", evidenceText: verbSlice }, documents };
  return { event: { kind: "unknown", evidenceText: null }, documents };
}

function wordAt(folded: string, pattern: string | RegExp): { start: number; end: number } | null {
  const expression = typeof pattern === "string" ? new RegExp(`\\b${pattern}\\b`) : pattern;
  const match = expression.exec(folded);
  if (!match || match.index < 0) return null;
  return { start: match.index, end: match.index + match[0].length };
}

function foldMap(value: string): { folded: string; toOriginal: number[] } {
  const toOriginal: number[] = [];
  let folded = "";
  for (let index = 0; index < value.length; index += 1) {
    const normalized = fold(value.charAt(index));
    for (let offset = 0; offset < normalized.length; offset += 1) {
      folded += normalized.charAt(offset);
      toOriginal.push(index);
    }
  }
  return { folded, toOriginal };
}

function fold(value: string): string {
  return value
    .replace(/[’‘´`]/g, "'")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function candidateOf(row: BusinessDirectoryRow): EntityCandidate {
  const service = row.table === "product" && row.productKind === "service";
  return {
    family: row.table,
    entityType: service ? "service" : row.table,
    entityId: row.id,
    entityName: row.name,
  };
}

function byCandidate(left: EntityCandidate, right: EntityCandidate): number {
  const family = FAMILIES.indexOf(left.family) - FAMILIES.indexOf(right.family);
  if (family !== 0) return family;
  return left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0;
}

function uniqueHints(hints: ModelHint[]): ModelHint[] {
  return HINTS.filter((hint) => hints.includes(hint));
}

function uniqueFamilies(families: Family[]): Family[] {
  return FAMILIES.filter((family) => families.includes(family));
}

function projectNames(project: ProjectContext): string[] {
  if (project.state === "matched" || project.state === "current") return [project.projectName];
  if (project.state === "ambiguous") return project.projectNames;
  return [];
}

function relation(kind: BusinessRelation["kind"], value: Span, entity: BusinessEntityMention): BusinessRelation {
  return {
    kind,
    valueAnchor: { start: value.start, end: value.end },
    entityAnchor: { start: entity.start, end: entity.end },
  };
}

function plainSpan(span: Span): { text: string; start: number; end: number } {
  return { text: span.text, start: span.start, end: span.end };
}

function distinctSpans(mentions: SituationMention[]): AnchorRef[] {
  const seen = new Set<string>();
  const spans: AnchorRef[] = [];
  for (const mention of mentions) {
    const id = keyOf(mention);
    if (seen.has(id)) continue;
    seen.add(id);
    spans.push({ start: mention.start, end: mention.end });
  }
  return spans;
}

function countOf(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

function pushIssue(issues: Issue[], reason: BusinessIssueReason, mentionText: string): void {
  if (issues.some((issue) => issue.reason === reason && issue.mentionText === mentionText)) return;
  issues.push({ reason, mentionText });
}

function sameAnchor(left: AnchorRef, right: AnchorRef): boolean {
  return left.start === right.start && left.end === right.end;
}

function keyOf(span: AnchorRef): string {
  return `${span.start}:${span.end}`;
}

function isHint(value: string): value is ModelHint {
  return value === "client" || value === "supplier" || value === "product";
}

function storedContext(value: unknown): BusinessContext | null {
  if (!isRecord(value)) return null;
  if ("actors" in value || "items" in value || "fields" in value) return null;
  const source = storedSource(value.source);
  const projectContext = storedProject(value.projectContext);
  const event = storedEvent(value.event);
  const entities = storedEntities(value.entities);
  const quantities = storedValues(value.quantities);
  const amounts = storedValues(value.amounts);
  const relations = storedRelations(value.relations);
  const documents = storedDocuments(value.documents);
  const issues = storedIssues(value.issues);
  const provenance = storedProvenance(value.provenance);
  const attachments = value.attachments;
  if (!source || !projectContext || !event || !entities || !quantities || !amounts || !relations || !documents || !issues || !provenance) {
    return null;
  }
  if (!isRecord(attachments) || attachments.contentRead !== false || !Array.isArray(attachments.fileIds)) return null;
  if (!attachments.fileIds.every((item) => typeof item === "string")) return null;
  return {
    source,
    projectContext,
    event,
    entities,
    quantities,
    amounts,
    relations,
    documents,
    attachments: { fileIds: attachments.fileIds.slice(), contentRead: false },
    issues,
    provenance,
  };
}

function storedSource(value: unknown): SituationReading["source"] | null {
  if (!isRecord(value) || typeof value.userText !== "string" || typeof value.conversationId !== "string") return null;
  if (!Array.isArray(value.fileIds) || !value.fileIds.every((item) => typeof item === "string")) return null;
  return {
    conversationId: value.conversationId,
    inboxItemId: typeof value.inboxItemId === "string" ? value.inboxItemId : null,
    fileIds: value.fileIds.slice(),
    userText: value.userText,
  };
}

function storedProject(value: unknown): ProjectContext | null {
  if (!isRecord(value) || typeof value.state !== "string") return null;
  if (value.state === "unresolved") return { state: "unresolved" };
  if (value.state === "ambiguous" && Array.isArray(value.projectNames) && value.projectNames.every((item) => typeof item === "string")) {
    return { state: "ambiguous", projectNames: value.projectNames.slice() };
  }
  if ((value.state === "current" || value.state === "matched") && typeof value.projectId === "string" && typeof value.projectName === "string") {
    return { state: value.state, projectId: value.projectId, projectName: value.projectName };
  }
  return null;
}

function storedEvent(value: unknown): BusinessContext["event"] | null {
  if (!isRecord(value) || typeof value.kind !== "string" || !EVENT_KINDS.includes(value.kind as BusinessEventKind)) return null;
  if (value.evidenceText !== null && typeof value.evidenceText !== "string") return null;
  return { kind: value.kind as BusinessEventKind, evidenceText: value.evidenceText };
}

function storedEntities(value: unknown): BusinessEntityMention[] | null {
  if (!Array.isArray(value)) return null;
  const entities: BusinessEntityMention[] = [];
  for (const item of value) {
    const entity = storedEntity(item);
    if (!entity) return null;
    entities.push(entity);
  }
  return entities;
}

function storedEntity(value: unknown): BusinessEntityMention | null {
  if (!isRecord(value) || typeof value.mentionText !== "string" || typeof value.start !== "number" || typeof value.end !== "number") {
    return null;
  }
  if (!Array.isArray(value.modelHints) || !value.modelHints.every((item) => isHint(String(item)))) return null;
  if (value.view !== "actor" && value.view !== "item" && value.view !== null) return null;
  const resolution = storedResolution(value.resolution);
  if (!resolution) return null;
  return {
    mentionText: value.mentionText,
    start: value.start,
    end: value.end,
    modelHints: value.modelHints.filter(isHint),
    resolution,
    view: value.view,
  };
}

function storedResolution(value: unknown): EntityResolution | null {
  if (!isRecord(value) || typeof value.state !== "string") return null;
  if (value.state === "unresolved") return { state: "unresolved" };
  if (value.state === "resolved") {
    if (!isFamily(value.family) || !isEntityType(value.entityType)) return null;
    if (typeof value.entityId !== "string" || typeof value.entityName !== "string" || typeof value.conflict !== "boolean") return null;
    return {
      state: "resolved",
      family: value.family,
      entityType: value.entityType,
      entityId: value.entityId,
      entityName: value.entityName,
      conflict: value.conflict,
    };
  }
  if (value.state === "ambiguous" && (value.scope === "same_family" || value.scope === "cross_family") && Array.isArray(value.candidates)) {
    const candidates: EntityCandidate[] = [];
    for (const item of value.candidates) {
      if (!isRecord(item) || !isFamily(item.family) || !isEntityType(item.entityType)) return null;
      if (typeof item.entityId !== "string" || typeof item.entityName !== "string") return null;
      candidates.push({
        family: item.family,
        entityType: item.entityType,
        entityId: item.entityId,
        entityName: item.entityName,
      });
    }
    return { state: "ambiguous", scope: value.scope, candidates };
  }
  return null;
}

function storedValues(value: unknown): Array<{ text: string; start: number; end: number }> | null {
  if (!Array.isArray(value)) return null;
  const spans: Array<{ text: string; start: number; end: number }> = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.text !== "string" || typeof item.start !== "number" || typeof item.end !== "number") return null;
    if ("linked" in item) return null;
    spans.push({ text: item.text, start: item.start, end: item.end });
  }
  return spans;
}

function storedRelations(value: unknown): BusinessRelation[] | null {
  if (!Array.isArray(value)) return null;
  const relations: BusinessRelation[] = [];
  for (const item of value) {
    if (!isRecord(item) || (item.kind !== "quantity_for_item" && item.kind !== "amount_for_item")) return null;
    const valueAnchor = storedAnchor(item.valueAnchor);
    const entityAnchor = storedAnchor(item.entityAnchor);
    if (!valueAnchor || !entityAnchor) return null;
    relations.push({ kind: item.kind, valueAnchor, entityAnchor });
  }
  return relations;
}

function storedAnchor(value: unknown): AnchorRef | null {
  if (!isRecord(value) || typeof value.start !== "number" || typeof value.end !== "number") return null;
  return { start: value.start, end: value.end };
}

function storedDocuments(value: unknown): BusinessContext["documents"] | null {
  if (!Array.isArray(value)) return null;
  const documents: BusinessContext["documents"] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.mentionText !== "string" || typeof item.kind !== "string") return null;
    if (!DOCUMENT_KINDS.includes(item.kind as (typeof DOCUMENT_KINDS)[number])) return null;
    documents.push({ kind: item.kind as BusinessContext["documents"][number]["kind"], mentionText: item.mentionText });
  }
  return documents;
}

function storedIssues(value: unknown): Issue[] | null {
  if (!Array.isArray(value)) return null;
  const issues: Issue[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.reason !== "string" || !REASONS.includes(item.reason as BusinessIssueReason)) return null;
    const issue: Issue = { reason: item.reason as BusinessIssueReason };
    if (item.mentionText !== undefined) {
      if (typeof item.mentionText !== "string") return null;
      issue.mentionText = item.mentionText;
    }
    if (item.detail !== undefined) {
      if (typeof item.detail !== "string") return null;
      issue.detail = item.detail;
    }
    issues.push(issue);
  }
  return issues;
}

function storedProvenance(value: unknown): BusinessContext["provenance"] | null {
  if (!isRecord(value)) return null;
  if (value.event !== "server-rule" || value.documents !== "server-rule" || value.resolution !== "server-rule" || value.projectContext !== "server-rule") {
    return null;
  }
  const mentions = value.mentions;
  if (!isRecord(mentions)) return null;
  if (mentions.origin === "none") {
    return {
      mentions: { origin: "none" },
      event: "server-rule",
      documents: "server-rule",
      resolution: "server-rule",
      projectContext: "server-rule",
    };
  }
  if (mentions.origin === "ollama" && typeof mentions.model === "string") {
    return {
      mentions: { origin: "ollama", model: mentions.model },
      event: "server-rule",
      documents: "server-rule",
      resolution: "server-rule",
      projectContext: "server-rule",
    };
  }
  return null;
}

function isFamily(value: unknown): value is Family {
  return value === "client" || value === "supplier" || value === "product";
}

function isEntityType(value: unknown): value is EntityType {
  return value === "client" || value === "supplier" || value === "product" || value === "service";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
