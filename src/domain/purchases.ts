import type { AnswerPacket } from "./answer-packet.ts";
import { centsFromWritten, formatCents } from "./pricing.ts";

export const PURCHASE_FAMILIES = ["serveur", "poste", "portable", "reseau", "prestation", "autre", "sous-traitance"] as const;
export type PurchaseFamily = (typeof PURCHASE_FAMILIES)[number];

export const REMAINDERS = ["ouvert", "partiel", "clos"] as const;
export type Remainder = (typeof REMAINDERS)[number];

export const DELIVERIES = ["chez_nous", "chez_client"] as const;
export type Delivery = (typeof DELIVERIES)[number];

const FAMILY_LABEL: Record<PurchaseFamily, string> = {
  serveur: "Serveur",
  poste: "Poste de travail",
  portable: "Portable",
  reseau: "Réseau",
  prestation: "Prestation",
  autre: "Autre",
  "sous-traitance": "Sous-traitance",
};

const REMAINDER_LABEL: Record<Remainder, string> = {
  ouvert: "Ouvert",
  partiel: "Partiel",
  clos: "Clos",
};

const DELIVERY_LABEL: Record<Delivery, string> = {
  chez_nous: "Chez nous",
  chez_client: "Chez le client",
};

export const GAP_METHOD =
  "L’écart est la facture reçue moins le bon de commande, deux montants déjà enregistrés. Le total additionne ces écarts. Une ligne sans facture écrite n’est pas comparée. Le modèle ne les estime pas.";

export const OVERDUE_METHOD =
  "La date d’expédition déjà enregistrée est comparée à la date du jour. Un reliquat clos n’est pas compté. Le modèle ne l’estime pas.";

export const DIRECT_METHOD =
  "Le numéro de suivi est recopié. Aucun message n’est envoyé. Le modèle ne l’invente pas.";

export const OUTSTANDING_METHOD =
  "L’encours et le délai sont ceux déjà enregistrés sur la fiche fournisseur. Le total additionne ces encours. Le modèle ne les estime pas.";

export const SUBCONTRACT_METHOD =
  "Le total additionne les montants de commande déjà enregistrés des lignes de famille sous-traitance. Le modèle ne l’estime pas.";

export const VOLUME_METHOD =
  "Le volume additionne les montants de commande déjà enregistrés, par fournisseur. Le modèle ne l’estime pas.";

const FAMILY_ASK = "Indiquez la famille : serveur, poste, portable, réseau, prestation, autre ou sous-traitance.";
const FAMILY_MANY = "Une seule famille : serveur, poste, portable, réseau, prestation, autre ou sous-traitance.";
const ORDER_ASK = "Indiquez le montant du bon de commande.";
const INVOICE_ASK = "Indiquez le montant de la facture reçue.";
const REMAINDER_ASK = "Indiquez le reliquat : ouvert, partiel ou clos.";
const REMAINDER_MANY = "Un seul reliquat : ouvert, partiel ou clos.";
const DELIVERY_ASK = "Indiquez la livraison : chez nous ou chez le client.";
const DELIVERY_MANY = "Une seule livraison : chez nous ou chez le client.";
const DATE_ASK = "Indiquez la date de commande, par exemple commandé le 2026-02-01.";
const DESIGNATION_ASK = "Indiquez la désignation.";
const DAYS_ASK = "Indiquez le délai en jours, par exemple 60 jours.";
const DAYS_MANY = "Un seul délai en jours.";
const OUTSTANDING_ASK = "Indiquez le montant de l’encours.";
const USD = "Montant en dollars. L’achat en euro n’est pas proposé.";

export type StoredPurchase = {
  supplierName: string;
  designation: string;
  family: PurchaseFamily;
  orderedOn: string;
  orderCents: number;
  invoiceCents: number | null;
  remainder: Remainder;
  shipsOn: string;
  tracking: string;
  delivery: Delivery;
};

export type PurchasePayload = StoredPurchase & {
  supplierId: string;
  projectId: string;
  projectName: string;
};

export type SupplierTerms = {
  supplierName: string;
  outstandingCents: number;
  paymentDays: number;
};

export type SupplierTermsPayload = SupplierTerms & { supplierId: string };

export type PurchaseSketch = {
  designation: string;
  family: PurchaseFamily | "";
  orderedOn: string;
  orderCents: number | null;
  invoiceCents: number | null;
  invoiceAsked: boolean;
  remainder: Remainder | "";
  shipsOn: string;
  tracking: string;
  delivery: Delivery | "";
  dossierName: string;
  familyConflict: boolean;
  remainderConflict: boolean;
  deliveryConflict: boolean;
};

export type TermsSketch = {
  outstandingCents: number | null;
  paymentDays: number | null;
  daysConflict: boolean;
};

export type PurchaseQuestion =
  | { kind: "gap" }
  | { kind: "overdue" }
  | { kind: "direct" }
  | { kind: "outstanding"; days: number | null; daysConflict: boolean }
  | { kind: "subcontract"; period: "year" | "unsupported" | "missing" }
  | { kind: "volume"; period: "year" | "unsupported" | "missing" };

export function purchaseFamilyLabel(family: PurchaseFamily): string {
  return FAMILY_LABEL[family];
}

export function remainderLabel(value: Remainder): string {
  return REMAINDER_LABEL[value];
}

export function deliveryLabel(value: Delivery): string {
  return DELIVERY_LABEL[value];
}

export function yearWindow(now: Date): { from: string; to: string; label: string } {
  const year = now.getUTCFullYear();
  return { from: `${year}-01-01`, to: `${year + 1}-01-01`, label: String(year) };
}

export function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function purchaseGap(orderCents: number, invoiceCents: number | null): number | null {
  if (invoiceCents === null) return null;
  return invoiceCents - orderCents;
}

export function readPurchaseQuestion(text: string): PurchaseQuestion | null {
  const folded = fold(text);
  if (isPurchaseEntry(folded) || isTermsEntry(folded)) return null;
  if (/\becart\b/.test(folded) && /\b(?:bon de commande|facture|grossiste)\b/.test(folded)) return { kind: "gap" };
  if (/\breliquats?\b/.test(folded) && /\b(?:depassee|expedition)\b/.test(folded)) return { kind: "overdue" };
  if (/\b(?:suivis?|tracking|relance)\b/.test(folded) && /\b(?:livraison directe|chez le client)\b/.test(folded)) {
    return { kind: "direct" };
  }
  if (/\bencours\b/.test(folded) && /\b(?:jours|paiement)\b/.test(folded)) {
    const days = dayValues(folded);
    return { kind: "outstanding", days: days.length === 1 ? days[0] ?? null : null, daysConflict: days.length > 1 };
  }
  if (/\bsous[- ]traitance\b/.test(folded) && /\b(?:montant|depuis|annee)\b/.test(folded)) {
    return { kind: "subcontract", period: yearPeriod(folded) };
  }
  if (/\bvolume\b/.test(folded) && /\b(?:constructeur|grossiste|fournisseur)\b/.test(folded)) {
    return { kind: "volume", period: yearPeriod(folded) };
  }
  return null;
}

export function readPurchaseEntry(text: string): PurchaseSketch | null {
  const folded = fold(text);
  if (!isPurchaseEntry(folded)) return null;
  const families = familiesNamed(folded);
  const remainders = remaindersNamed(folded);
  const deliveries = deliveriesNamed(folded);
  const invoiceWord = /\bfacture\b/.test(folded);
  return {
    designation: designationOf(text),
    family: families.length === 1 ? families[0] ?? "" : "",
    orderedOn: dateAfter(text, /\bcommand[ée]e?(?:\s+le)?\s+/i),
    orderCents: amountAfter(text, /\bbon de commande\s+/i),
    invoiceCents: invoiceWord ? amountAfter(text, /\bfacture\s+/i) : null,
    invoiceAsked: invoiceWord && amountAfter(text, /\bfacture\s+/i) === null,
    remainder: remainders.length === 1 ? remainders[0] ?? "" : "",
    shipsOn: dateAfter(text, /\bexp[ée]dition(?:\s+le)?\s+/i),
    tracking: trackingOf(text),
    dossierName: dossierNameOf(text),
    delivery: deliveries.length === 1 ? deliveries[0] ?? "" : "",
    familyConflict: families.length > 1,
    remainderConflict: remainders.length > 1,
    deliveryConflict: deliveries.length > 1,
  };
}

export function readSupplierTerms(text: string): TermsSketch | null {
  const folded = fold(text);
  if (!isTermsEntry(folded)) return null;
  const days = dayValues(folded);
  return {
    outstandingCents: amountAfter(text, /\bencours(?:\s+de)?\s+/i),
    paymentDays: days.length === 1 ? days[0] ?? null : null,
    daysConflict: days.length > 1,
  };
}

export function purchaseGapMessage(sketch: PurchaseSketch, dollars = false): string | null {
  if (dollars) return USD;
  if (sketch.familyConflict) return FAMILY_MANY;
  if (!sketch.family) return FAMILY_ASK;
  if (sketch.orderCents === null) return ORDER_ASK;
  if (sketch.invoiceAsked) return INVOICE_ASK;
  if (sketch.remainderConflict) return REMAINDER_MANY;
  if (!sketch.remainder) return REMAINDER_ASK;
  if (sketch.deliveryConflict) return DELIVERY_MANY;
  if (!sketch.delivery) return DELIVERY_ASK;
  if (!sketch.orderedOn) return DATE_ASK;
  if (sketch.designation.trim().length < 2) return DESIGNATION_ASK;
  return null;
}

export function termsGapMessage(sketch: TermsSketch, dollars = false): string | null {
  if (dollars) return USD;
  if (sketch.outstandingCents === null) return OUTSTANDING_ASK;
  if (sketch.daysConflict) return DAYS_MANY;
  if (sketch.paymentDays === null) return DAYS_ASK;
  return null;
}

export function hasDollars(text: string): boolean {
  return /\$|\busd\b/i.test(text);
}

export function purchasePayload(value: unknown): PurchasePayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PurchasePayload>;
  if (!textId(raw.supplierId) || !named(raw.supplierName) || !named(raw.designation)) return null;
  if (!isFamily(raw.family) || !isRemainder(raw.remainder) || !isDelivery(raw.delivery)) return null;
  if (!isIsoDate(raw.orderedOn) || !optionalDate(raw.shipsOn)) return null;
  if (!wholeCents(raw.orderCents) || !optionalCents(raw.invoiceCents)) return null;
  if (!optionalText(raw.tracking)) return null;
  return {
    supplierId: raw.supplierId,
    supplierName: raw.supplierName.trim(),
    designation: raw.designation.trim(),
    family: raw.family,
    orderedOn: raw.orderedOn,
    orderCents: raw.orderCents,
    invoiceCents: raw.invoiceCents,
    remainder: raw.remainder,
    shipsOn: raw.shipsOn,
    tracking: raw.tracking.trim(),
    delivery: raw.delivery,
    projectId: typeof raw.projectId === "string" ? raw.projectId.trim() : "",
    projectName: typeof raw.projectName === "string" ? raw.projectName.trim() : "",
  };
}

export function dossierNameOf(text: string): string {
  return text.match(/\bdossier\s+([^,\n]+)/i)?.[1]?.trim() ?? "";
}

export function termsPayload(value: unknown): SupplierTermsPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SupplierTermsPayload>;
  if (!textId(raw.supplierId) || !named(raw.supplierName)) return null;
  if (!wholeCents(raw.outstandingCents) || !wholeDays(raw.paymentDays)) return null;
  return {
    supplierId: raw.supplierId,
    supplierName: raw.supplierName.trim(),
    outstandingCents: raw.outstandingCents,
    paymentDays: raw.paymentDays,
  };
}

export function gapPacket(input: { rows: StoredPurchase[]; supplierName: string; pending: number }): AnswerPacket {
  const scoped = input.supplierName ? input.rows.filter((row) => row.supplierName === input.supplierName) : input.rows;
  const compared = scoped.flatMap((row) => {
    const gap = purchaseGap(row.orderCents, row.invoiceCents);
    return gap === null ? [] : [{ row, gap }];
  });
  const missingInvoice = scoped.length - compared.length;
  const total = compared.reduce((sum, item) => sum + item.gap, 0);
  return {
    title: "Écart de facture",
    period: "",
    filters: [input.supplierName || "Tous les fournisseurs"],
    measures: [
      { label: "Lignes", value: String(compared.length) },
      { label: "Écart", value: compared.length === 0 ? "aucun" : formatCents(total) },
    ],
    rows: compared.map((item) => ({
      label: `${item.row.supplierName} · ${item.row.designation}`,
      detail: `commande ${formatCents(item.row.orderCents)}, facture ${formatCents(item.row.invoiceCents)}, écart ${item.gap === 0 ? `égal ${formatCents(0)}` : formatCents(item.gap)}`,
    })),
    sources: ["Achats confirmés"],
    missing: [
      missingInvoice > 0 ? `${missingInvoice} ligne(s) sans facture écrite ne sont pas comparées.` : "",
      compared.length === 0 ? "Aucune ligne confirmée n’a les deux montants." : "",
      ...pendingLine(input.pending),
    ].filter(Boolean),
    method: GAP_METHOD,
  };
}

export function overduePacket(input: { rows: StoredPurchase[]; today: string; pending: number }): AnswerPacket {
  const open = input.rows.filter((row) => row.remainder !== "clos");
  const dated = open.filter((row) => row.shipsOn !== "" && row.shipsOn < input.today);
  const undated = open.filter((row) => row.shipsOn === "").length;
  return {
    title: "Reliquats en retard",
    period: `expédition avant ${input.today}`,
    filters: ["Ouvert", "Partiel"],
    measures: [{ label: "Reliquats", value: String(dated.length) }],
    rows: dated.map((row) => ({
      label: `${row.supplierName} · ${row.designation}`,
      detail: `${remainderLabel(row.remainder)}, expédition ${row.shipsOn}`,
    })),
    sources: ["Achats confirmés"],
    missing: [
      dated.length === 0 ? "Aucun reliquat ouvert n’a une expédition dépassée." : "",
      undated > 0 ? `${undated} reliquat(s) sans date d’expédition ne sont pas comptés.` : "",
      ...pendingLine(input.pending),
    ].filter(Boolean),
    method: OVERDUE_METHOD,
  };
}

export function directPacket(input: { rows: StoredPurchase[]; pending: number }): AnswerPacket {
  const direct = input.rows.filter((row) => row.delivery === "chez_client");
  const tracked = direct.filter((row) => row.tracking !== "");
  const bare = direct.length - tracked.length;
  return {
    title: "Livraisons directes",
    period: "",
    filters: ["Chez le client"],
    measures: [{ label: "Suivis", value: String(tracked.length) }],
    rows: tracked.map((row) => ({
      label: `${row.supplierName} · ${row.designation}`,
      detail: `suivi ${row.tracking}`,
    })),
    sources: ["Achats confirmés"],
    missing: [
      bare > 0 ? `${bare} livraison(s) directe(s) sans numéro de suivi.` : "",
      tracked.length === 0 ? "Aucune livraison directe n’a de numéro de suivi." : "",
      ...pendingLine(input.pending),
    ].filter(Boolean),
    method: DIRECT_METHOD,
  };
}

export function outstandingPacket(input: { rows: SupplierTerms[]; days: number; pending: number }): AnswerPacket {
  const kept = input.rows.filter((row) => row.paymentDays === input.days && row.outstandingCents > 0);
  const total = kept.reduce((sum, row) => sum + row.outstandingCents, 0);
  return {
    title: "Encours fournisseurs",
    period: "",
    filters: [`${input.days} jours`],
    measures: [
      { label: "Fournisseurs", value: String(kept.length) },
      { label: "Encours", value: kept.length === 0 ? "aucun" : formatCents(total) },
    ],
    rows: kept.map((row) => ({
      label: row.supplierName,
      detail: `${formatCents(row.outstandingCents)}, ${row.paymentDays} jours`,
    })),
    sources: ["Fiches fournisseur confirmées"],
    missing: [kept.length === 0 ? "Aucun fournisseur confirmé n’a cet encours et ce délai." : "", ...termsPending(input.pending)].filter(Boolean),
    method: OUTSTANDING_METHOD,
  };
}

export function subcontractPacket(input: { rows: StoredPurchase[]; from: string; to: string; label: string; pending: number }): AnswerPacket {
  const kept = input.rows.filter((row) => row.family === "sous-traitance" && row.orderedOn >= input.from && row.orderedOn < input.to);
  const total = kept.reduce((sum, row) => sum + row.orderCents, 0);
  return {
    title: "Sous-traitance",
    period: `${input.label} · ${input.from} → ${input.to}`,
    filters: ["Sous-traitance"],
    measures: [
      { label: "Montant", value: kept.length === 0 ? "aucun" : formatCents(total) },
      { label: "Lignes", value: String(kept.length) },
    ],
    rows: kept.map((row) => ({
      label: `${row.supplierName} · ${row.designation}`,
      detail: `${row.orderedOn}, ${formatCents(row.orderCents)}`,
    })),
    sources: ["Achats confirmés"],
    missing: [kept.length === 0 ? "Aucune sous-traitance confirmée sur cette période." : "", ...pendingLine(input.pending)].filter(Boolean),
    method: SUBCONTRACT_METHOD,
  };
}

export function volumePacket(input: { rows: StoredPurchase[]; from: string; to: string; label: string; pending: number }): AnswerPacket {
  const kept = input.rows.filter((row) => row.orderedOn >= input.from && row.orderedOn < input.to);
  const groups = new Map<string, number>();
  for (const row of kept) groups.set(row.supplierName, (groups.get(row.supplierName) ?? 0) + row.orderCents);
  const names = [...groups.keys()].sort((left, right) => left.localeCompare(right));
  const total = names.reduce((sum, name) => sum + (groups.get(name) ?? 0), 0);
  return {
    title: "Volume d’achat",
    period: `${input.label} · ${input.from} → ${input.to}`,
    filters: ["Par fournisseur"],
    measures: [{ label: "Volume", value: names.length === 0 ? "aucun" : formatCents(total) }],
    rows: names.map((name) => ({ label: name, detail: formatCents(groups.get(name) ?? 0) })),
    sources: ["Achats confirmés"],
    missing: [names.length === 0 ? "Aucun achat confirmé sur cette période." : "", ...pendingLine(input.pending)].filter(Boolean),
    method: VOLUME_METHOD,
  };
}

export function purchaseGapPacket(missing: string): AnswerPacket {
  return gap("Achat à confirmer", missing);
}

export function termsGapPacket(missing: string): AnswerPacket {
  return gap("Encours à confirmer", missing);
}

export function periodGapPacket(title: string, missing: string): AnswerPacket {
  return gap(title, missing);
}

export function purchaseProposalPacket(draft: Omit<PurchasePayload, "supplierId">): AnswerPacket {
  return {
    title: "Achat à confirmer",
    period: draft.orderedOn,
    filters: [draft.supplierName, purchaseFamilyLabel(draft.family)],
    measures: [
      { label: "Commande", value: formatCents(draft.orderCents) },
      { label: "Facture", value: formatCents(draft.invoiceCents) },
    ],
    rows: [
      { label: "Désignation", detail: draft.designation },
      { label: "Reliquat", detail: remainderLabel(draft.remainder) },
      { label: "Livraison", detail: deliveryLabel(draft.delivery) },
      ...(draft.shipsOn ? [{ label: "Expédition", detail: draft.shipsOn }] : []),
      ...(draft.tracking ? [{ label: "Suivi", detail: draft.tracking }] : []),
      ...(draft.projectName ? [{ label: "Dossier", detail: draft.projectName }] : []),
    ],
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method: "Les montants sont ceux écrits dans la phrase. L’écart n’est pas stocké. Le modèle ne les propose pas.",
  };
}

export function termsProposalPacket(draft: Omit<SupplierTermsPayload, "supplierId">): AnswerPacket {
  return {
    title: "Encours à confirmer",
    period: "",
    filters: [draft.supplierName],
    measures: [
      { label: "Encours", value: formatCents(draft.outstandingCents) },
      { label: "Délai", value: `${draft.paymentDays} jours` },
    ],
    rows: [],
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method: "L’encours et le délai sont ceux écrits dans la phrase. Le modèle ne les propose pas.",
  };
}

export function purchaseFields(draft: Omit<PurchasePayload, "supplierId">): Array<{ label: string; value: string }> {
  return [
    { label: "Fournisseur", value: draft.supplierName },
    { label: "Désignation", value: draft.designation },
    { label: "Famille", value: purchaseFamilyLabel(draft.family) },
    { label: "Commandé le", value: draft.orderedOn },
    { label: "Commande", value: formatCents(draft.orderCents) },
    { label: "Facture", value: formatCents(draft.invoiceCents) },
    { label: "Reliquat", value: remainderLabel(draft.remainder) },
    { label: "Livraison", value: deliveryLabel(draft.delivery) },
    ...(draft.shipsOn ? [{ label: "Expédition", value: draft.shipsOn }] : []),
    ...(draft.tracking ? [{ label: "Suivi", value: draft.tracking }] : []),
    ...(draft.projectName ? [{ label: "Dossier", value: draft.projectName }] : []),
  ];
}

export function termsFields(draft: Omit<SupplierTermsPayload, "supplierId">): Array<{ label: string; value: string }> {
  return [
    { label: "Fournisseur", value: draft.supplierName },
    { label: "Encours", value: formatCents(draft.outstandingCents) },
    { label: "Délai", value: `${draft.paymentDays} jours` },
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

function pendingLine(pending: number): string[] {
  if (pending <= 0) return [];
  return [pending === 1 ? "1 achat en attente de confirmation n’est pas compté." : `${pending} achats en attente de confirmation ne sont pas comptés.`];
}

function termsPending(pending: number): string[] {
  if (pending <= 0) return [];
  return [pending === 1 ? "1 encours en attente de confirmation n’est pas compté." : `${pending} encours en attente de confirmation ne sont pas comptés.`];
}

function isPurchaseEntry(folded: string): boolean {
  return /\b(?:enregistre|enregistrer|proposer|proposez|propose|ajoute|ajouter|creer|saisir|saisis)\b/.test(folded) && /\bachats?\b/.test(folded);
}

function isTermsEntry(folded: string): boolean {
  if (isPurchaseEntry(folded)) return false;
  if (!/\b(?:enregistre|enregistrer|proposer|proposez|propose|ajoute|ajouter|creer|saisir|saisis)\b/.test(folded)) return false;
  return /\bencours\b/.test(folded) || (/\bpaiement\b/.test(folded) && /\bjours\b/.test(folded));
}

function familiesNamed(folded: string): PurchaseFamily[] {
  const found: PurchaseFamily[] = [];
  if (/\bserveurs?\b/.test(folded)) found.push("serveur");
  if (/\bpostes?\b/.test(folded)) found.push("poste");
  if (/\bportables?\b/.test(folded)) found.push("portable");
  if (/\breseaux?\b/.test(folded)) found.push("reseau");
  if (/\bprestations?\b/.test(folded)) found.push("prestation");
  if (/\bsous[- ]traitance\b/.test(folded)) found.push("sous-traitance");
  if (/\bautre\b/.test(folded)) found.push("autre");
  return found;
}

function remaindersNamed(folded: string): Remainder[] {
  const found: Remainder[] = [];
  if (/\bsans reliquat\b|\breliquat clos\b|\breliquat solde\b/.test(folded)) found.push("clos");
  if (/\breliquat partiel\b/.test(folded)) found.push("partiel");
  if (/\breliquat ouvert\b/.test(folded)) found.push("ouvert");
  if (found.length === 0 && /\breliquat\b/.test(folded)) found.push("ouvert");
  return found;
}

function deliveriesNamed(folded: string): Delivery[] {
  const found: Delivery[] = [];
  if (/\b(?:chez le client|livraison directe)\b/.test(folded)) found.push("chez_client");
  if (/\bchez nous\b/.test(folded)) found.push("chez_nous");
  return found;
}

function yearPeriod(folded: string): "year" | "unsupported" | "missing" {
  if (/\bdepuis le debut de l'annee\b|\bcette annee\b/.test(folded)) return "year";
  if (/\b(?:annee|mois|trimestre)\b/.test(folded)) return "unsupported";
  return "missing";
}

function dayValues(folded: string): number[] {
  return [...folded.matchAll(/\b(\d{1,3})\s*jours\b/g)].flatMap((match) => {
    const value = Number(match[1]);
    return Number.isInteger(value) && value >= 1 && value <= 365 ? [value] : [];
  });
}

function designationOf(text: string): string {
  return text.match(/(?:désignation|designation)\s+([^,\n]+)/i)?.[1]?.trim() ?? "";
}

function trackingOf(text: string): string {
  return text.match(/\bsuivi\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/i)?.[1] ?? "";
}

function amountAfter(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const from = (match.index ?? 0) + match[0].length;
  const slice = text
    .slice(from, from + 40)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/g, " ");
  const marked = slice.match(/(\d{1,3}(?:[ .\u00a0]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b)/i);
  return marked ? centsFromWritten(marked[0]) : null;
}

function dateAfter(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match) return "";
  const from = (match.index ?? 0) + match[0].length;
  return firstDate(text.slice(from, from + 24));
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

function optionalDate(value: unknown): value is string {
  return value === "" || isIsoDate(value);
}

function isFamily(value: unknown): value is PurchaseFamily {
  return typeof value === "string" && PURCHASE_FAMILIES.includes(value as PurchaseFamily);
}

function isRemainder(value: unknown): value is Remainder {
  return typeof value === "string" && REMAINDERS.includes(value as Remainder);
}

function isDelivery(value: unknown): value is Delivery {
  return typeof value === "string" && DELIVERIES.includes(value as Delivery);
}

function wholeCents(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function optionalCents(value: unknown): value is number | null {
  return value === null || wholeCents(value);
}

function wholeDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 365;
}

function textId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function named(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2;
}

function optionalText(value: unknown): value is string {
  return typeof value === "string";
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'");
}
