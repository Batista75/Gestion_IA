import type { BusinessPlan } from "./business-brief.ts";
import { nameKey, plainLabel, type CatalogCommand, type PartyInput } from "./catalog.ts";

export type PlanSource = "ollama";

export type CreateClientAction = {
  type: "CREATE_CLIENT";
  args: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
};

export type CreateProjectAction = {
  type: "CREATE_PROJECT";
  args: {
    name: string;
    clientName: string;
  };
};

export type PlannedAction = CreateClientAction | CreateProjectAction;

export type FieldConfidenceValue = {
  field: string;
  value: number;
};

export type StructuredPlan = {
  source: "ollama";
  actions: PlannedAction[];
  missing: string[];
  confidence?: FieldConfidenceValue[];
  explanation?: string;
};

export type KnownClient = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type ContactField = "email" | "phone" | "address";

export type PlanTranslation =
  | { kind: "catalog"; command: CatalogCommand }
  | { kind: "business"; plan: BusinessPlan }
  | { kind: "already"; name: string }
  | { kind: "unknown-client"; clientName: string }
  | { kind: "contact-differs"; name: string; fields: ContactField[]; withProject: boolean }
  | { kind: "omitted"; fields: ContactField[]; withProject: boolean }
  | { kind: "clarify" }
  | { kind: "missing" };

const RAW_LIMIT = 4_000;
const NAME_MAX = 120;
const EMAIL_MAX = 120;
const PHONE_MAX = 40;
const ADDRESS_MAX = 200;
const EXPLANATION_MAX = 300;
const MISSING_MAX = 4;
const MISSING_TEXT_MAX = 120;
const CONFIDENCE_MAX = 8;
const ACTION_MAX = 2;

const PLAN_KEYS = new Set(["source", "actions", "missing", "confidence", "explanation"]);
const ACTION_KEYS = new Set(["type", "args"]);
const CLIENT_ARG_KEYS = new Set(["name", "email", "phone", "address"]);
const PROJECT_ARG_KEYS = new Set(["name", "clientName"]);
const CONFIDENCE_KEYS = new Set(["field", "value"]);
const CONFIDENCE_FIELDS = new Set(["name", "clientName", "email", "phone", "address"]);
const FORBIDDEN = new Set([
  "id",
  "clientId",
  "supplierId",
  "projectId",
  "productId",
  "conversationId",
  "inboxItemId",
  "fileId",
  "fileIds",
  "quoteId",
  "demandId",
  "storedFileId",
  "proposalId",
]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function structuredPlanGuide(): string {
  return [
    "Tu réponds par un seul objet JSON, sans texte autour et sans outil.",
    "Tu ne crées rien, tu ne calcules rien, tu ne choisis aucun identifiant.",
    "actions contient au plus deux objets, types CREATE_CLIENT ou CREATE_PROJECT seulement.",
    "CREATE_CLIENT.args : name, et email, phone, address seulement s’ils sont écrits dans la demande.",
    "CREATE_PROJECT.args : name est le dossier, le projet ou l’affaire ; clientName suit pour, chez ou client.",
    "N’invente pas de mail, de téléphone, d’adresse, de montant, de TVA ni de risque.",
    "Interdit : id, clientId, supplierId, projectId, productId, conversationId, inboxItemId, fileId, fileIds.",
    "missing liste ce qui manque pour nommer le client ou le dossier, sinon [].",
    "explanation est une courte phrase, ou absente.",
  ].join(" ");
}

const QUESTION =
  /^(?:liste(?:r|z)?|montre(?:r|z)?|affiche(?:r|z)?|combien|quels?|quelles?|où|comment|pourquoi|qu['’]est-ce|est-ce|c['’]est quoi|peut-on|puis-je)\b|\b(?:peut-on|puis-je|est-ce que|comment)\b/i;
const NEGATION =
  /\bn['’](?:cr[ée]e|ajout|ouvr)\w*\s+pas\b|\bne\s+(?:veux\s+pas\s+|souhaite\s+pas\s+)?(?:cr[ée]e|ajout|ouvr)\w*\s+pas\b|\bne\s+veux\s+pas\b|\bsurtout\s+ne\b/i;
const OPPOSITE =
  /\b(supprim\w*|effac\w*|modifi\w*|mets?\s+[àa]\s+jour|mettre\s+[àa]\s+jour|change\w*|corrige\w*)\b/i;
const CLIENT_CREATE =
  /\b(cr[ée]e[rz]?|cr[ée]er|cr[ée]ation|ajout(?:e|er|ez|ons)?|nouveau(?:x)?\s+clients?|nouvelle\s+cliente)\b/i;
const PROJECT_CREATE =
  /\b(?:ouvr(?:e|ez|ir|ons)?|cr[ée]e[rz]?|cr[ée]er|nouveau)\s+(?:le\s+|la\s+|un\s+|une\s+)?(?:nouveau\s+)?(?:dossier|projet|affaire)\b[\s\S]*\b(?:pour|chez|client|cliente)\b/i;

const OUTSIDE_V0 =
  /\b(fournisseurs?|produits?|articles?|contrats?|interventions?|equipements?|reclamations?|retours?|catalogues?)\b/;

const CLIENT_CREATION_SHAPE =
  /\bcomme\s+clients?\b|\b(?:nouveau|nouveaux|nouvelle)\s+clientes?\b|\bcr[ée](?:e|er|ez|ation)\s+(?:d['’]un\s+compte\s+)?(?:le\s+|un\s+|une\s+)?clients?\b|\bajout(?:e|er|ez)?\s+(?:le\s+|un\s+|une\s+)?(?:compte\s+)?clients?\b/i;

export function structuredPlanEligible(text: string): boolean {
  const source = text.trim();
  if (!source || QUESTION.test(source) || NEGATION.test(source) || OPPOSITE.test(source)) return false;
  if (outsideStructuredPlan(source)) return false;
  return CLIENT_CREATE.test(source) || PROJECT_CREATE.test(source);
}

export function explicitClientCreation(text: string): boolean {
  const source = text.trim();
  return structuredPlanEligible(source) && CLIENT_CREATION_SHAPE.test(source);
}

export function outsideStructuredPlan(text: string): boolean {
  return OUTSIDE_V0.test(foldPlan(text));
}

export function structuredPlanGate(eligible: boolean, unfinished: boolean): "plan" | "continue" {
  if (!eligible || unfinished) return "continue";
  return "plan";
}

export function structuredAttemptOutcome(eligible: boolean, accepted: boolean): "propose" | "block" | "continue" {
  if (!eligible) return "continue";
  return accepted ? "propose" : "block";
}

export function valueAnchored(message: string, value: string): boolean {
  return expressionAnchored(message, value);
}

export function projectRolesMatch(message: string, projectName: string, clientName: string): boolean {
  const text = anchorText(message);
  const match = /\b(dossier|projet|affaire)\b([\s\S]*?)\b(pour|chez|client|cliente)\b([\s\S]*)$/.exec(text);
  if (!match) return false;
  return expressionAnchored(match[2], projectName) && expressionAnchored(match[4], clientName);
}

export function parseStructuredPlan(
  raw: string,
  message: string,
): { ok: true; plan: StructuredPlan } | { ok: false } {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > RAW_LIMIT) return { ok: false };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (hasForbidden(value)) return { ok: false };
  const plan = readPlan(value);
  if (!plan) return { ok: false };
  if (!anchored(plan, message)) return { ok: false };
  return { ok: true, plan };
}

export type ContactHints = {
  emails: string[];
  phones: string[];
  addresses: string[];
};

export function detectStructuredContactHints(message: string): ContactHints {
  const emails: string[] = [];
  for (const item of message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) ?? []) {
    const email = item.toLowerCase().replace(/[.,;:!?]+$/g, "");
    if (EMAIL.test(email) && !emails.includes(email)) emails.push(email);
  }
  const phones: string[] = [];
  for (const number of phoneCandidates(message)) {
    if (!phones.includes(number)) phones.push(number);
  }
  const addresses: string[] = [];
  for (const segment of addressSegments(message)) {
    const address = anchorText(segment);
    if (address && !addresses.includes(address)) addresses.push(address);
  }
  return { emails, phones, addresses };
}

export function findOmittedStructuredFields(message: string, plan: StructuredPlan): ContactField[] {
  const hints = detectStructuredContactHints(message);
  const emails: string[] = [];
  const phones: string[] = [];
  const addresses: string[] = [];
  for (const action of plan.actions) {
    if (action.type !== "CREATE_CLIENT") continue;
    if (action.args.email) emails.push(action.args.email.trim().toLowerCase().replace(/[.,;:!?]+$/g, ""));
    if (action.args.phone) phones.push(digits(action.args.phone));
    if (action.args.address) addresses.push(anchorText(action.args.address));
  }
  const omitted: ContactField[] = [];
  if (hints.emails.some((item) => !emails.includes(item))) omitted.push("email");
  if (hints.phones.some((item) => !phones.includes(item))) omitted.push("phone");
  if (hints.addresses.some((item) => !addresses.includes(item))) omitted.push("address");
  return omitted;
}

export function translateStructuredPlan(
  plan: StructuredPlan,
  found: KnownClient | null,
  message: string,
): PlanTranslation {
  if (outsideStructuredPlan(message)) return { kind: "clarify" };
  if (!planNamesAreLabels(plan) || dropsUnstoredDetail(message)) return { kind: "clarify" };
  const omitted = findOmittedStructuredFields(message, plan);
  if (omitted.length > 0) {
    return { kind: "omitted", fields: omitted, withProject: plan.actions.some((action) => action.type === "CREATE_PROJECT") };
  }
  if (plan.missing.length > 0) return { kind: "missing" };
  const [first, second] = plan.actions;
  if (!first) return { kind: "clarify" };
  if (!second && first.type === "CREATE_CLIENT") {
    if (!found) return { kind: "catalog", command: clientCommand(first) };
    const gap = contactGap(first, found);
    if (gap) return { kind: "contact-differs", name: found.name, fields: gap, withProject: false };
    return { kind: "already", name: found.name };
  }
  if (!second && first.type === "CREATE_PROJECT") {
    if (!projectRolesMatch(message, first.args.name, first.args.clientName)) return { kind: "clarify" };
    if (!found) return { kind: "unknown-client", clientName: first.args.clientName };
    return { kind: "catalog", command: projectCommand(first.args.name, found.name) };
  }
  if (
    second &&
    first.type === "CREATE_CLIENT" &&
    second.type === "CREATE_PROJECT" &&
    nameKey(first.args.name) === nameKey(second.args.clientName)
  ) {
    if (!projectRolesMatch(message, second.args.name, second.args.clientName)) return { kind: "clarify" };
    if (found) {
      const gap = contactGap(first, found);
      if (gap) return { kind: "contact-differs", name: found.name, fields: gap, withProject: true };
      return { kind: "catalog", command: projectCommand(second.args.name, found.name) };
    }
    if (first.args.phone || first.args.address) return { kind: "clarify" };
    return { kind: "business", plan: businessPlan(first, second) };
  }
  return { kind: "clarify" };
}

export function resolutionName(plan: StructuredPlan): string | null {
  if (plan.missing.length > 0) return null;
  const [first, second] = plan.actions;
  if (!first) return null;
  if (!second && first.type === "CREATE_CLIENT") return first.args.name;
  if (!second && first.type === "CREATE_PROJECT") return first.args.clientName;
  if (
    second &&
    first.type === "CREATE_CLIENT" &&
    second.type === "CREATE_PROJECT" &&
    nameKey(first.args.name) === nameKey(second.args.clientName)
  ) {
    return first.args.name;
  }
  return null;
}

function anchored(plan: StructuredPlan, message: string): boolean {
  for (const action of plan.actions) {
    if (action.type === "CREATE_CLIENT") {
      if (!expressionAnchored(message, action.args.name)) return false;
      if (action.args.email && !emailAnchored(message, action.args.email)) return false;
      if (action.args.phone && !phoneAnchored(message, action.args.phone)) return false;
      if (action.args.address && !addressAnchored(message, action.args.address)) return false;
    } else {
      if (!expressionAnchored(message, action.args.name)) return false;
      if (!expressionAnchored(message, action.args.clientName)) return false;
    }
  }
  return true;
}

function contactGap(action: CreateClientAction, found: KnownClient): ContactField[] | null {
  const gap: ContactField[] = [];
  if (action.args.email && !sameEmail(action.args.email, found.email)) gap.push("email");
  if (action.args.phone && !samePhone(action.args.phone, found.phone)) gap.push("phone");
  if (action.args.address && !sameAddress(action.args.address, found.address)) gap.push("address");
  return gap.length > 0 ? gap : null;
}

function sameEmail(provided: string, stored: string): boolean {
  const left = provided.trim().toLowerCase();
  const right = stored.trim().toLowerCase();
  return Boolean(left) && left === right;
}

function samePhone(provided: string, stored: string): boolean {
  const left = digits(provided);
  const right = digits(stored);
  return left.length >= 10 && left === right;
}

function sameAddress(provided: string, stored: string): boolean {
  const left = anchorText(provided);
  const right = anchorText(stored);
  return Boolean(left) && left === right;
}

function readPlan(value: unknown): StructuredPlan | null {
  if (!isRecord(value) || !exactKeys(value, PLAN_KEYS)) return null;
  if ("source" in value && typeof value.source !== "string") return null;
  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > ACTION_MAX) return null;
  const actions: PlannedAction[] = [];
  for (const item of value.actions) {
    const action = readAction(item);
    if (!action) return null;
    actions.push(action);
  }
  if (!Array.isArray(value.missing) || value.missing.length > MISSING_MAX) return null;
  const missing: string[] = [];
  for (const item of value.missing) {
    if (typeof item !== "string") return null;
    const text = item.trim();
    if (!text || text.length > MISSING_TEXT_MAX) return null;
    missing.push(text);
  }
  const plan: StructuredPlan = { source: "ollama", actions, missing };
  if ("explanation" in value) {
    if (typeof value.explanation !== "string") return null;
    const explanation = value.explanation.trim();
    if (explanation.length > EXPLANATION_MAX) return null;
    if (explanation) plan.explanation = explanation;
  }
  if ("confidence" in value) {
    const confidence = readConfidence(value.confidence);
    if (!confidence) return null;
    if (confidence.length > 0) plan.confidence = confidence;
  }
  return plan;
}

function readAction(value: unknown): PlannedAction | null {
  if (!isRecord(value) || !exactKeys(value, ACTION_KEYS)) return null;
  if (value.type === "CREATE_CLIENT") return readClient(value.args);
  if (value.type === "CREATE_PROJECT") return readProject(value.args);
  return null;
}

function readClient(value: unknown): CreateClientAction | null {
  if (!isRecord(value) || !exactKeys(value, CLIENT_ARG_KEYS) || !("name" in value)) return null;
  const name = bounded(value.name, 2, NAME_MAX);
  if (!name) return null;
  const args: CreateClientAction["args"] = { name };
  if ("email" in value) {
    const email = optionalText(value.email, EMAIL_MAX);
    if (email === null) return null;
    if (email) {
      if (!EMAIL.test(email)) return null;
      args.email = email;
    }
  }
  if ("phone" in value) {
    const phone = optionalText(value.phone, PHONE_MAX);
    if (phone === null) return null;
    if (phone) args.phone = phone;
  }
  if ("address" in value) {
    const address = optionalText(value.address, ADDRESS_MAX);
    if (address === null) return null;
    if (address) args.address = address;
  }
  return { type: "CREATE_CLIENT", args };
}

function readProject(value: unknown): CreateProjectAction | null {
  if (!isRecord(value) || !exactKeys(value, PROJECT_ARG_KEYS)) return null;
  const name = bounded(value.name, 2, NAME_MAX);
  const clientName = bounded(value.clientName, 2, NAME_MAX);
  if (!name || !clientName) return null;
  return { type: "CREATE_PROJECT", args: { name, clientName } };
}

function readConfidence(value: unknown): FieldConfidenceValue[] | null {
  if (!Array.isArray(value) || value.length > CONFIDENCE_MAX) return null;
  const rows: FieldConfidenceValue[] = [];
  for (const item of value) {
    if (!isRecord(item) || !exactKeys(item, CONFIDENCE_KEYS)) return null;
    if (typeof item.field !== "string" || typeof item.value !== "number") return null;
    const field = item.field.trim();
    if (!CONFIDENCE_FIELDS.has(field) || !Number.isFinite(item.value) || item.value < 0 || item.value > 1) return null;
    rows.push({ field, value: item.value });
  }
  return rows;
}

function clientCommand(action: CreateClientAction): CatalogCommand {
  const party: PartyInput = {
    name: action.args.name,
    siren: "",
    email: action.args.email ?? "",
    phone: action.args.phone ?? "",
    address: action.args.address ?? "",
    notes: "",
  };
  return { type: "create_client", party };
}

function projectCommand(name: string, primaryClient: string): CatalogCommand {
  return { type: "create_project", name, primaryClient, nextAction: "Qualifier le besoin" };
}

function businessPlan(client: CreateClientAction, project: CreateProjectAction): BusinessPlan {
  return {
    clients: [
      {
        reference: "",
        name: client.args.name,
        country: "",
        sector: "",
        currency: "",
        contactName: "",
        email: client.args.email ?? "",
      },
    ],
    articles: [],
    projects: [
      {
        reference: "",
        name: project.args.name,
        clientRef: "",
        primaryClient: client.args.name,
        sector: "",
        budgetStated: "",
        status: "À qualifier",
        lead: "",
        purpose: "",
        currency: "EUR",
      },
    ],
    quotes: [],
  };
}

function bounded(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  return text;
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length > max) return null;
  return text;
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasForbidden(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasForbidden(item));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, item]) => FORBIDDEN.has(key) || hasForbidden(item));
}

function expressionAnchored(message: string, value: string): boolean {
  const hay = anchorText(message);
  const needle = anchorText(value);
  const useful = needle.replace(/[^0-9a-zàâäçéèêëîïôùûüœæ]/g, "");
  if (useful.length < 3 || !/[a-zàâäçéèêëîïôùûüœæ]/.test(useful)) return false;
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : hay.charAt(at - 1);
    const after = hay.charAt(at + needle.length);
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + 1;
  }
  return false;
}

function emailAnchored(message: string, value: string): boolean {
  const expected = value.trim().toLowerCase().replace(/[.,;:!?]+$/g, "");
  if (!EMAIL.test(expected)) return false;
  const found = message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) ?? [];
  return found.some((item) => item.toLowerCase().replace(/[.,;:!?]+$/g, "") === expected);
}

function phoneAnchored(message: string, value: string): boolean {
  const expected = digits(value);
  if (expected.length < 10) return false;
  return phoneCandidates(message).includes(expected);
}

function phoneCandidates(message: string): string[] {
  const found: string[] = [];
  const pattern = /\+?\d(?:[\s./-]*\d){9,}/g;
  let match: RegExpExecArray | null = pattern.exec(message);
  while (match) {
    const number = digits(match[0]);
    if (number.length >= 10) found.push(number);
    match = pattern.exec(message);
  }
  return found;
}

function addressAnchored(message: string, value: string): boolean {
  const needle = anchorText(value);
  if (!needle) return false;
  return addressSegments(message).some((segment) => anchorText(segment) === needle);
}

function addressSegments(message: string): string[] {
  const found: string[] = [];
  const pattern =
    /\b\d{1,5}\s+(?:bis\s+|ter\s+)?(?:rue|avenue|boulevard|bd|chemin|impasse|place|all[ée]e|route|quai|cours|voie|sentier)\b[^,.;\n]*/gi;
  let match: RegExpExecArray | null = pattern.exec(message);
  while (match) {
    found.push(match[0]);
    match = pattern.exec(message);
  }
  return found;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function planNamesAreLabels(plan: StructuredPlan): boolean {
  return plan.actions.every((action) =>
    action.type === "CREATE_CLIENT"
      ? plainLabel(action.args.name)
      : plainLabel(action.args.name) && plainLabel(action.args.clientName),
  );
}

function dropsUnstoredDetail(message: string): boolean {
  const hints = detectStructuredContactHints(message);
  if (hints.addresses.length > 0 || hints.phones.length > 0 || hints.emails.length > 0) return false;
  return /\b(qui|avec|habite)\b/.test(message.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

function foldPlan(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isWordChar(value: string): boolean {
  return /[0-9a-zàâäçéèêëîïôùûüœæ'-]/.test(value);
}

function anchorText(value: string): string {
  return value
    .replace(/[’‘´`]/g, "'")
    .replace(/\s*([,.;:!?])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
