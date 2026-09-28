import type { AnswerPacket } from "./answer-packet.ts";

export const CLAIM_KINDS = ["deballage", "retard"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_STATUSES = ["ouverte", "en_cours", "closee"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const RETURN_KINDS = ["retour", "remplacement"] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];

export const RETURN_STATUSES = ["en_cours", "clos"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

const CLAIM_LABEL: Record<ClaimKind, string> = {
  deballage: "Panne au déballage",
  retard: "Retard de livraison",
};

const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  closee: "Clôturée",
};

const RETURN_LABEL: Record<ReturnKind, string> = {
  retour: "Retour",
  remplacement: "Remplacement",
};

const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  en_cours: "En cours",
  clos: "Clos",
};

export const CLAIM_METHOD =
  "Le nombre compte les réclamations confirmées du mois, des types demandés. Le texte de chaque ligne est celui déjà enregistré. Le modèle ne le rédige pas.";

export const RETURN_METHOD =
  "Le nombre compte les retours confirmés encore en cours et sous garantie. Le texte de chaque ligne est celui déjà enregistré. Le modèle ne le rédige pas.";

const CLAIM_KIND_ASK = "Indiquez le type : panne au déballage ou retard de livraison.";
const CLAIM_KIND_MANY = "Un seul type : panne au déballage ou retard de livraison.";
const CLAIM_STATUS_ASK = "Indiquez l’état : ouverte, en cours ou clôturée.";
const CLAIM_STATUS_MANY = "Un seul état : ouverte, en cours ou clôturée.";
const RETURN_KIND_ASK = "Indiquez le type : retour ou remplacement.";
const RETURN_KIND_MANY = "Un seul type : retour ou remplacement.";
const RETURN_STATUS_ASK = "Indiquez l’état : en cours ou clos.";
const RETURN_STATUS_MANY = "Un seul état : en cours ou clos.";
const WARRANTY_ASK = "Indiquez si c’est sous garantie ou hors garantie.";
const WARRANTY_MANY = "Une seule mention : sous garantie ou hors garantie.";
const DATE_ASK = "Indiquez la date, par exemple le 2026-09-10.";
const NOTE_ASK = "Indiquez le texte déjà constaté.";
const PERIOD_ASK = "Indiquez la période : ce mois.";
const PERIOD_UNSUPPORTED = "Ce résumé se demande sur ce mois.";

export type StoredClaim = {
  clientName: string;
  kind: ClaimKind;
  occurredOn: string;
  status: ClaimStatus;
  note: string;
};

export type ClaimPayload = StoredClaim & { clientId: string };

export type StoredReturn = {
  clientName: string;
  kind: ReturnKind;
  occurredOn: string;
  status: ReturnStatus;
  underWarranty: boolean;
  note: string;
};

export type ReturnPayload = StoredReturn & { clientId: string };

export type ClaimSketch = {
  kind: ClaimKind | "";
  occurredOn: string;
  status: ClaimStatus | "";
  note: string;
  kindConflict: boolean;
  statusConflict: boolean;
};

export type ReturnSketch = {
  kind: ReturnKind | "";
  occurredOn: string;
  status: ReturnStatus | "";
  underWarranty: boolean | null;
  warrantyConflict: boolean;
  note: string;
  kindConflict: boolean;
  statusConflict: boolean;
};

export type ClaimQuestion =
  | { kind: "claims"; types: ClaimKind[]; period: "month" | "unsupported" | "missing" }
  | { kind: "returns"; types: ReturnKind[]; warranty: boolean | null; warrantyConflict: boolean; openOnly: boolean };

export function claimKindLabel(kind: ClaimKind): string {
  return CLAIM_LABEL[kind];
}

export function returnKindLabel(kind: ReturnKind): string {
  return RETURN_LABEL[kind];
}

export function monthWindow(now: Date): { from: string; to: string; label: string } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(from),
  };
}

export function readClaimQuestion(text: string): ClaimQuestion | null {
  const folded = fold(text);
  if (isClaimEntry(folded) || isReturnEntry(folded)) return null;
  if (/\breclamations?\b/.test(folded) && /\b(?:mois|deballage|retard|resume)\b/.test(folded)) {
    return { kind: "claims", types: claimKinds(folded), period: monthPeriod(folded) };
  }
  if (/\b(?:retours?|remplacements?)\b/.test(folded) && /\b(?:en cours|sous garantie|hors garantie)\b/.test(folded)) {
    const warranty = warrantyOf(folded);
    return {
      kind: "returns",
      types: returnKinds(folded),
      warranty: warranty.value,
      warrantyConflict: warranty.conflict,
      openOnly: /\ben cours\b/.test(folded),
    };
  }
  return null;
}

export function readClaimEntry(text: string): ClaimSketch | null {
  const folded = fold(text);
  if (!isClaimEntry(folded)) return null;
  const kinds = claimKinds(folded);
  const statuses = claimStatuses(folded);
  return {
    kind: kinds.length === 1 ? kinds[0] ?? "" : "",
    occurredOn: firstDate(text),
    status: statuses.length === 1 ? statuses[0] ?? "" : "",
    note: noteOf(text),
    kindConflict: kinds.length > 1,
    statusConflict: statuses.length > 1,
  };
}

export function readReturnEntry(text: string): ReturnSketch | null {
  const folded = fold(text);
  if (!isReturnEntry(folded)) return null;
  const kinds = returnKinds(folded);
  const statuses = returnStatuses(folded);
  const warranty = warrantyOf(folded);
  return {
    kind: kinds.length === 1 ? kinds[0] ?? "" : "",
    occurredOn: firstDate(text),
    status: statuses.length === 1 ? statuses[0] ?? "" : "",
    underWarranty: warranty.value,
    warrantyConflict: warranty.conflict,
    note: noteOf(text),
    kindConflict: kinds.length > 1,
    statusConflict: statuses.length > 1,
  };
}

export function claimGap(sketch: ClaimSketch): string | null {
  if (sketch.kindConflict) return CLAIM_KIND_MANY;
  if (!sketch.kind) return CLAIM_KIND_ASK;
  if (sketch.statusConflict) return CLAIM_STATUS_MANY;
  if (!sketch.status) return CLAIM_STATUS_ASK;
  if (!sketch.occurredOn) return DATE_ASK;
  if (sketch.note.trim().length < 2) return NOTE_ASK;
  return null;
}

export function returnGap(sketch: ReturnSketch): string | null {
  if (sketch.kindConflict) return RETURN_KIND_MANY;
  if (!sketch.kind) return RETURN_KIND_ASK;
  if (sketch.warrantyConflict) return WARRANTY_MANY;
  if (sketch.underWarranty === null) return WARRANTY_ASK;
  if (sketch.statusConflict) return RETURN_STATUS_MANY;
  if (!sketch.status) return RETURN_STATUS_ASK;
  if (!sketch.occurredOn) return DATE_ASK;
  if (sketch.note.trim().length < 2) return NOTE_ASK;
  return null;
}

export function claimPayload(value: unknown): ClaimPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ClaimPayload>;
  if (!textId(raw.clientId) || !named(raw.clientName) || !named(raw.note)) return null;
  if (!isClaimKind(raw.kind) || !isClaimStatus(raw.status) || !isIsoDate(raw.occurredOn)) return null;
  return {
    clientId: raw.clientId,
    clientName: raw.clientName.trim(),
    kind: raw.kind,
    occurredOn: raw.occurredOn,
    status: raw.status,
    note: raw.note.trim(),
  };
}

export function returnPayload(value: unknown): ReturnPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReturnPayload>;
  if (!textId(raw.clientId) || !named(raw.clientName) || !named(raw.note)) return null;
  if (!isReturnKind(raw.kind) || !isReturnStatus(raw.status) || typeof raw.underWarranty !== "boolean") return null;
  if (!isIsoDate(raw.occurredOn)) return null;
  return {
    clientId: raw.clientId,
    clientName: raw.clientName.trim(),
    kind: raw.kind,
    occurredOn: raw.occurredOn,
    status: raw.status,
    underWarranty: raw.underWarranty,
    note: raw.note.trim(),
  };
}

export function claimsPacket(input: {
  rows: StoredClaim[];
  types: ClaimKind[];
  from: string;
  to: string;
  label: string;
  pending: number;
}): AnswerPacket {
  if (input.types.length === 0) return gap("Réclamations du mois", CLAIM_KIND_ASK);
  const kept = input.rows
    .filter((row) => input.types.includes(row.kind) && row.occurredOn >= input.from && row.occurredOn < input.to)
    .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn));
  return {
    title: "Réclamations du mois",
    period: `${input.label} · ${input.from} → ${input.to}`,
    filters: input.types.map(claimKindLabel),
    measures: [{ label: "Réclamations", value: String(kept.length) }],
    rows: kept.map((row) => ({
      label: `${row.clientName} · ${row.occurredOn}`,
      detail: `${claimKindLabel(row.kind)}, ${CLAIM_STATUS_LABEL[row.status]}, ${row.note}`,
    })),
    sources: ["Réclamations confirmées"],
    missing: [kept.length === 0 ? "Aucune réclamation confirmée de ce type sur ce mois." : "", ...pendingClaims(input.pending)].filter(Boolean),
    method: CLAIM_METHOD,
  };
}

export function returnsPacket(input: { rows: StoredReturn[]; types: ReturnKind[]; pending: number }): AnswerPacket {
  if (input.types.length === 0) return gap("Retours en cours", RETURN_KIND_ASK);
  const kept = input.rows
    .filter((row) => input.types.includes(row.kind) && row.status === "en_cours" && row.underWarranty)
    .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn));
  return {
    title: "Retours en cours",
    period: "",
    filters: [...input.types.map(returnKindLabel), "Sous garantie", "En cours"],
    measures: [{ label: "Retours", value: String(kept.length) }],
    rows: kept.map((row) => ({
      label: `${row.clientName} · ${row.occurredOn}`,
      detail: `${returnKindLabel(row.kind)}, sous garantie, ${row.note}`,
    })),
    sources: ["Retours confirmés"],
    missing: [kept.length === 0 ? "Aucun retour sous garantie n’est en cours." : "", ...pendingReturns(input.pending)].filter(Boolean),
    method: RETURN_METHOD,
  };
}

export function claimGapPacket(missing: string): AnswerPacket {
  return gap("Réclamation à confirmer", missing);
}

export function returnGapPacket(missing: string): AnswerPacket {
  return gap("Retour à confirmer", missing);
}

export function claimPeriodPacket(period: "missing" | "unsupported"): AnswerPacket {
  return gap("Réclamations du mois", period === "missing" ? PERIOD_ASK : PERIOD_UNSUPPORTED);
}

export function claimProposalPacket(draft: Omit<ClaimPayload, "clientId">): AnswerPacket {
  return {
    title: "Réclamation à confirmer",
    period: draft.occurredOn,
    filters: [draft.clientName, claimKindLabel(draft.kind)],
    measures: [{ label: "État", value: CLAIM_STATUS_LABEL[draft.status] }],
    rows: [{ label: "Texte", detail: draft.note }],
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method: "Le texte est celui écrit dans la phrase. Le modèle ne le rédige pas.",
  };
}

export function returnProposalPacket(draft: Omit<ReturnPayload, "clientId">): AnswerPacket {
  return {
    title: "Retour à confirmer",
    period: draft.occurredOn,
    filters: [draft.clientName, returnKindLabel(draft.kind), draft.underWarranty ? "Sous garantie" : "Hors garantie"],
    measures: [{ label: "État", value: RETURN_STATUS_LABEL[draft.status] }],
    rows: [{ label: "Texte", detail: draft.note }],
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method: "Le texte est celui écrit dans la phrase. Le modèle ne le rédige pas.",
  };
}

export function claimFields(draft: Omit<ClaimPayload, "clientId">): Array<{ label: string; value: string }> {
  return [
    { label: "Client", value: draft.clientName },
    { label: "Type", value: claimKindLabel(draft.kind) },
    { label: "Date", value: draft.occurredOn },
    { label: "État", value: CLAIM_STATUS_LABEL[draft.status] },
    { label: "Texte", value: draft.note },
  ];
}

export function returnFields(draft: Omit<ReturnPayload, "clientId">): Array<{ label: string; value: string }> {
  return [
    { label: "Client", value: draft.clientName },
    { label: "Type", value: returnKindLabel(draft.kind) },
    { label: "Date", value: draft.occurredOn },
    { label: "Garantie", value: draft.underWarranty ? "Sous garantie" : "Hors garantie" },
    { label: "État", value: RETURN_STATUS_LABEL[draft.status] },
    { label: "Texte", value: draft.note },
  ];
}

function gap(title: string, missing: string): AnswerPacket {
  return {
    title,
    period: "",
    filters: [],
    measures: [],
    rows: [],
    sources: [],
    missing: [missing],
    method: "Rien n’est calculé tant qu’il manque cet élément.",
  };
}

function pendingClaims(pending: number): string[] {
  if (pending <= 0) return [];
  return [
    pending === 1
      ? "1 réclamation en attente de confirmation n’est pas comptée."
      : `${pending} réclamations en attente de confirmation ne sont pas comptées.`,
  ];
}

function pendingReturns(pending: number): string[] {
  if (pending <= 0) return [];
  return [pending === 1 ? "1 retour en attente de confirmation n’est pas compté." : `${pending} retours en attente de confirmation ne sont pas comptés.`];
}

function isClaimEntry(folded: string): boolean {
  return entryVerb(folded) && /\breclamations?\b/.test(folded);
}

function isReturnEntry(folded: string): boolean {
  if (isClaimEntry(folded)) return false;
  return entryVerb(folded) && /\b(?:retours?|remplacements?)\b/.test(folded);
}

function entryVerb(folded: string): boolean {
  return /\b(?:enregistre|enregistrer|proposer|proposez|propose|ajoute|ajouter|creer|saisir|saisis)\b/.test(folded);
}

function claimKinds(folded: string): ClaimKind[] {
  const found: ClaimKind[] = [];
  if (/\bdeballage\b/.test(folded)) found.push("deballage");
  if (/\bretard\b/.test(folded)) found.push("retard");
  return found;
}

function returnKinds(folded: string): ReturnKind[] {
  const found: ReturnKind[] = [];
  if (/\bretours?\b/.test(folded)) found.push("retour");
  if (/\bremplacements?\b/.test(folded)) found.push("remplacement");
  return found;
}

function claimStatuses(folded: string): ClaimStatus[] {
  const found: ClaimStatus[] = [];
  if (/\ben cours\b/.test(folded)) found.push("en_cours");
  if (/\b(?:cloturee|fermee|closee)\b/.test(folded)) found.push("closee");
  if (/\bouverte\b/.test(folded)) found.push("ouverte");
  return found;
}

function returnStatuses(folded: string): ReturnStatus[] {
  const found: ReturnStatus[] = [];
  if (/\ben cours\b/.test(folded)) found.push("en_cours");
  if (/\b(?:clos|cloture|cloturee|ferme|fermee)\b/.test(folded)) found.push("clos");
  return found;
}

function warrantyOf(folded: string): { value: boolean | null; conflict: boolean } {
  const covered = /\bsous garantie\b/.test(folded);
  const uncovered = /\bhors garantie\b/.test(folded);
  if (covered && uncovered) return { value: null, conflict: true };
  if (covered) return { value: true, conflict: false };
  if (uncovered) return { value: false, conflict: false };
  return { value: null, conflict: false };
}

function monthPeriod(folded: string): "month" | "unsupported" | "missing" {
  if (/\b(?:ce mois|du mois|ce mois-ci)\b/.test(folded)) return "month";
  if (/\b(?:mois|annee|trimestre)\b/.test(folded)) return "unsupported";
  return "missing";
}

function noteOf(text: string): string {
  return text.match(/\b(?:texte|note)\s+([\s\S]+)/i)?.[1]?.trim() ?? "";
}

function firstDate(text: string): string {
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const iso = validIso(match[1] ?? "", match[2] ?? "", match[3] ?? "");
    if (iso) return iso;
  }
  for (const match of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const iso = validIso(match[3] ?? "", match[2] ?? "", match[1] ?? "");
    if (iso) return iso;
  }
  return "";
}

function validIso(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && validIso(value.slice(0, 4), value.slice(5, 7), value.slice(8, 10)) === value;
}

function isClaimKind(value: unknown): value is ClaimKind {
  return typeof value === "string" && CLAIM_KINDS.includes(value as ClaimKind);
}

function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === "string" && CLAIM_STATUSES.includes(value as ClaimStatus);
}

function isReturnKind(value: unknown): value is ReturnKind {
  return typeof value === "string" && RETURN_KINDS.includes(value as ReturnKind);
}

function isReturnStatus(value: unknown): value is ReturnStatus {
  return typeof value === "string" && RETURN_STATUSES.includes(value as ReturnStatus);
}

function textId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function named(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'");
}
