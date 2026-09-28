import type { AnswerPacket } from "./answer-packet.ts";
import { addUtcDays } from "./contracts.ts";
import { formatCents } from "./pricing.ts";

export const CASH_METHOD =
  "L’échéance fournisseur est la date de facture déjà écrite, plus le délai de paiement déjà confirmé sur la fiche, en jours UTC. Le montant est celui de la facture déjà enregistré. L’encaissement client n’apparaît que si une pièce confirmée porte déjà une date d’échéance. Aucune pénalité n’est calculée. Aucun encaissement ni rapprochement bancaire n’est enregistré. Le modèle ne les estime pas.";

export type CashQuestion = { period: "week" | "unsupported" | "missing" };

export type SupplierCash = {
  supplierName: string;
  designation: string;
  invoiceOn: string;
  invoiceCents: number | null;
  paymentDays: number | null;
};

export type ClientCash = {
  clientName: string;
  label: string;
  amountCents: number | null;
  dueOn: string;
};

export function readCashQuestion(text: string): CashQuestion | null {
  const folded = fold(text);
  if (/\bcontrats?\b/.test(folded)) return null;
  if (!/\b(?:tresorerie|encaissements?|echeances?)\b/.test(folded)) return null;
  if (!/\btresorerie\b/.test(folded) && !/\b(?:grossistes?|clients?|payer|encaisser|semaine)\b/.test(folded)) return null;
  if (/\b(?:cette semaine|la semaine|semaine en cours)\b/.test(folded)) return { period: "week" };
  if (/\b(?:mois|annee|trimestre)\b/.test(folded)) return { period: "unsupported" };
  return { period: "missing" };
}

export function weekWindow(now: Date): { from: string; to: string; label: string } {
  const day = now.getUTCDay();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day === 0 ? 6 : day - 1)));
  const next = new Date(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  return { from: monday.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10), label: "semaine en cours" };
}

export function cashWeekPacket(input: {
  suppliers: SupplierCash[];
  receipts: ClientCash[];
  from: string;
  to: string;
  undatedReceipts: number;
}): AnswerPacket {
  const payables: Array<{ supplierName: string; designation: string; dueOn: string; amountCents: number }> = [];
  let incomplete = 0;
  for (const row of input.suppliers) {
    if (!row.invoiceOn || row.paymentDays === null || row.invoiceCents === null) {
      incomplete += 1;
      continue;
    }
    const dueOn = addUtcDays(row.invoiceOn, row.paymentDays);
    if (dueOn < input.from || dueOn >= input.to) continue;
    payables.push({
      supplierName: row.supplierName,
      designation: row.designation,
      dueOn,
      amountCents: row.invoiceCents,
    });
  }
  payables.sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.designation.localeCompare(right.designation, "fr"));
  const receipts = input.receipts.filter(
    (row) => row.dueOn && row.amountCents !== null && row.dueOn >= input.from && row.dueOn < input.to,
  );
  const payableCents = payables.reduce((sum, row) => sum + row.amountCents, 0);
  const receiptCents = receipts.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  return {
    title: "Trésorerie de la semaine",
    period: `${input.from} → ${input.to}`,
    filters: ["Fournisseurs à payer", "Clients à encaisser"],
    measures: [
      { label: "À payer", value: payables.length === 0 ? "aucun" : formatCents(payableCents) },
      { label: "À encaisser", value: receipts.length === 0 ? "non indiqué" : formatCents(receiptCents) },
    ],
    rows: [
      ...payables.map((row) => ({
        label: row.supplierName,
        detail: `échéance ${row.dueOn}, ${formatCents(row.amountCents)}, ${row.designation}`,
      })),
      ...receipts.map((row) => ({
        label: row.clientName,
        detail: `échéance ${row.dueOn}, ${formatCents(row.amountCents)}, ${row.label}`,
      })),
    ],
    sources: ["Achats confirmés", "Délais confirmés"],
    missing: [
      incomplete > 0
        ? `${incomplete} achat(s) sans date de facture, sans montant ou sans délai confirmé ne sont pas datés.`
        : "",
      receipts.length === 0
        ? input.undatedReceipts > 0
          ? `${input.undatedReceipts} commande(s) client confirmée(s) n’ont pas de date d’échéance écrite.`
          : "Aucun encaissement client : aucune pièce confirmée ne porte une date d’échéance écrite."
        : "",
      "Aucune pénalité n’est calculée.",
    ].filter(Boolean),
    method: CASH_METHOD,
  };
}

export function cashGapPacket(missing: string): AnswerPacket {
  return {
    title: "Trésorerie de la semaine",
    period: "",
    filters: [],
    measures: [],
    rows: [],
    sources: [],
    missing: [missing],
    method: "Rien n’est listé tant qu’il manque cet élément.",
  };
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'");
}
