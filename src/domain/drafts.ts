import type { AnswerPacket } from "./answer-packet.ts";
import { formatCents } from "./pricing.ts";

export const DRAFT_METHOD =
  "Le texte recopie les noms, références, montants et dates déjà enregistrés. Aucun numéro de facture n’est attribué. Rien n’est envoyé. Le modèle ne rédige pas ce brouillon.";

export type DraftQuestion =
  | { kind: "invoice"; days: number | null; daysConflict: boolean }
  | { kind: "tracking" }
  | { kind: "quote" };

export type InvoiceSource = {
  supplierName: string;
  designation: string;
  invoiceReference: string;
  invoiceOn: string;
  invoiceCents: number | null;
};

export type TrackingSource = {
  supplierName: string;
  designation: string;
  orderedOn: string;
  tracking: string;
};

export type QuoteSource = {
  supplierName: string;
  productName: string;
  reference: string;
  costCents: number | null;
};

export function readDraftQuestion(text: string): DraftQuestion | null {
  const folded = fold(text);
  if (!/\b(?:prepare|preparer|redige|rediger|brouillon)\b/.test(folded)) return null;
  if (/\bcotation\b/.test(folded)) return { kind: "quote" };
  if (/\b(?:tracking|suivis?)\b/.test(folded)) return { kind: "tracking" };
  if (/\bfacture\b/.test(folded) || /\brelances?\b/.test(folded)) {
    const days = dayCounts(folded);
    return { kind: "invoice", days: days.length === 1 ? days[0] ?? null : null, daysConflict: days.length > 1 };
  }
  return null;
}

export function daysBefore(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function invoiceDraftPacket(input: { rows: InvoiceSource[]; days: number; today: string }): AnswerPacket {
  const ready = input.rows.filter((row) => row.invoiceReference.trim().length >= 2 && row.invoiceOn);
  const late = ready.filter((row) => {
    const age = daysBefore(row.invoiceOn, input.today);
    return age !== null && age >= input.days;
  });
  const skipped = input.rows.length - ready.length;
  return {
    title: "Relance de facture",
    period: `au ${input.today}`,
    filters: [`retard d’au moins ${input.days} jours`],
    measures: [{ label: "Brouillons", value: String(late.length) }],
    rows: late.map((row) => ({ label: row.supplierName, detail: invoiceText(row) })),
    sources: ["Achats confirmés"],
    missing: [
      late.length === 0 ? "Aucune facture enregistrée n’a à la fois une référence, une date et ce retard." : "",
      skipped > 0 ? `${skipped} facture(s) sans référence ou sans date ne sont pas relancées.` : "",
      "Aucun numéro de facture n’est attribué.",
      "Rien n’est envoyé.",
    ].filter(Boolean),
    method: DRAFT_METHOD,
  };
}

export function trackingDraftPacket(input: { supplierName: string; rows: TrackingSource[] }): AnswerPacket {
  const tracked = input.rows.filter((row) => row.tracking.trim().length >= 2);
  const bare = input.rows.length - tracked.length;
  return {
    title: "Relance de suivi",
    period: "",
    filters: [input.supplierName],
    measures: [{ label: "Brouillons", value: String(tracked.length) }],
    rows: tracked.map((row) => ({ label: row.designation, detail: trackingText(row) })),
    sources: ["Achats confirmés"],
    missing: [
      tracked.length === 0 ? "Aucun numéro de suivi n’est enregistré pour ce grossiste." : "",
      bare > 0 ? `${bare} achat(s) sans numéro de suivi ne sont pas cités.` : "",
      "Rien n’est envoyé.",
    ].filter(Boolean),
    method: DRAFT_METHOD,
  };
}

export function quoteDraftPacket(input: QuoteSource): AnswerPacket {
  return {
    title: "Demande de cotation",
    period: "",
    filters: [input.supplierName, input.productName],
    measures: [{ label: "Brouillons", value: "1" }],
    rows: [{ label: input.productName, detail: quoteText(input) }],
    sources: ["Catalogue"],
    missing: [
      input.reference ? "" : "La référence catalogue n’est pas écrite. Aucune n’est inventée.",
      input.costCents === null ? "Aucun coût écrit n’est recopié." : "",
      "Rien n’est envoyé.",
    ].filter(Boolean),
    method: DRAFT_METHOD,
  };
}

export function draftGapPacket(title: string, missing: string): AnswerPacket {
  return {
    title,
    period: "",
    filters: [],
    measures: [],
    rows: [],
    sources: [],
    missing: [missing],
    method: "Rien n’est rédigé tant qu’il manque cet élément.",
  };
}

function invoiceText(row: InvoiceSource): string {
  const amount = row.invoiceCents === null ? "montant non indiqué" : `montant ${formatCents(row.invoiceCents)}`;
  return `Bonjour ${row.supplierName}, la facture ${row.invoiceReference} du ${row.invoiceOn}, ${amount}, désignation ${row.designation}, est à relancer.`;
}

function trackingText(row: TrackingSource): string {
  return `Bonjour ${row.supplierName}, merci d’indiquer l’avancement du suivi ${row.tracking}, commande du ${row.orderedOn}, désignation ${row.designation}.`;
}

function quoteText(row: QuoteSource): string {
  const reference = row.reference ? `référence ${row.reference}` : "référence non écrite";
  const cost = row.costCents === null ? "aucun coût écrit" : `coût déjà écrit ${formatCents(row.costCents)}`;
  return `Bonjour ${row.supplierName}, merci de coter ${row.productName}, ${reference}. ${cost}.`;
}

function dayCounts(folded: string): number[] {
  return [...folded.matchAll(/\b(\d{1,3})\s*jours\b/g)].flatMap((match) => {
    const value = Number(match[1]);
    return Number.isInteger(value) && value >= 1 && value <= 365 ? [value] : [];
  });
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'");
}
