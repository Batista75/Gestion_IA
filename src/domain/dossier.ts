import type { AnswerPacket } from "./answer-packet.ts";
import { formatCents } from "./pricing.ts";

export const PROFIT_METHOD =
  "Les quatre nombres restent séparés. Les ventes additionnent les montants de ligne déjà stockés des commandes client confirmées. Les achats additionnent les montants de commande déjà enregistrés sur ce dossier. Les heures additionnent des montants de ligne déjà calculés : la durée en minutes multipliée par le taux horaire, arrondie au centime. Un taux journalier n’est pas mélangé. Le modèle ne les estime pas.";

export const STOCK_METHOD =
  "La valeur multiplie chaque stock écrit par le coût déjà écrit sur la fiche, puis additionne ces montants. La part réservée additionne les quantités des lignes des dossiers encore ouverts. Ces deux résultats ne sont pas stockés. Le modèle ne les estime pas.";

export const RECEIVED_METHOD =
  "Réceptionné veut dire reliquat clos. Une intervention planifiée est une intervention confirmée du même dossier, datée du jour ou plus tard. Un achat sans dossier n’a pas d’intervention. Le modèle ne les estime pas.";

export const UNRECOVERED_METHOD =
  "La liste compare la désignation déjà enregistrée aux noms des lignes de devis et aux références des pièces constatées du même dossier. Une désignation absente des deux est listée. Aucune facture n’est créée. Le modèle ne rédige pas la liste.";

const CLOSED_STATUS = /^(?:clos|cloture|cloturee|perdu|abandonne|termine|annule)$/;

export type DossierQuestion = { kind: "profit" } | { kind: "stock" } | { kind: "received" } | { kind: "unrecovered" };

export type ProfitSale = {
  name: string;
  family: string;
  kind: string;
  quantity: number;
  saleUnitCents: number | null;
};

export type ProfitPurchase = { designation: string; orderCents: number };

export type ProfitHour = {
  label: string;
  occurredOn: string;
  durationMinutes: number;
  rateUnit: "horaire" | "journalier";
  rateCents: number;
};

export type StockProduct = { name: string; stockQty: number | null; costCents: number | null };

export type StockLine = { projectName: string; open: boolean; quantity: number };

export type ReceivedPurchase = { designation: string; projectId: string; projectName: string; remainder: string };

export type PlannedIntervention = { projectId: string; occurredOn: string };

export type UnrecoveredPurchase = { designation: string };

export function readDossierQuestion(text: string): DossierQuestion | null {
  const folded = fold(text);
  if (/\brentabilite\b/.test(folded)) return { kind: "profit" };
  if (/\bstock\b/.test(folded) && /\b(?:atelier|reserv)/.test(folded)) return { kind: "stock" };
  if (/\breceptionn/.test(folded) && /\binterventions?\b/.test(folded)) return { kind: "received" };
  if (/\bachetes?\b/.test(folded) && /\babsent\b/.test(folded) && /\b(?:devis|facture)\b/.test(folded)) {
    return { kind: "unrecovered" };
  }
  return null;
}

export function projectIsOpen(status: string): boolean {
  return !CLOSED_STATUS.test(fold(status));
}

export function hourAmountCents(row: Pick<ProfitHour, "durationMinutes" | "rateUnit" | "rateCents">): number | null {
  if (row.rateUnit !== "horaire") return null;
  if (!Number.isInteger(row.durationMinutes) || row.durationMinutes < 0) return null;
  if (!Number.isInteger(row.rateCents) || row.rateCents < 0) return null;
  return Math.round((row.durationMinutes * row.rateCents) / 60);
}

export function lineSaleCents(line: Pick<ProfitSale, "quantity" | "saleUnitCents">): number | null {
  if (line.saleUnitCents === null) return null;
  if (!Number.isInteger(line.saleUnitCents) || line.saleUnitCents < 0) return null;
  if (!Number.isInteger(line.quantity) || line.quantity < 1) return null;
  return line.saleUnitCents * line.quantity;
}

export function profitPacket(input: {
  projectName: string;
  sales: ProfitSale[];
  purchases: ProfitPurchase[];
  hours: ProfitHour[];
  unconfirmedQuotes: number;
}): AnswerPacket {
  const material: AnswerRow[] = [];
  const services: AnswerRow[] = [];
  let materialCents = 0;
  let serviceCents = 0;
  let materialCount = 0;
  let serviceCount = 0;
  for (const line of input.sales) {
    const amount = lineSaleCents(line);
    const service = line.family === "prestation" || line.kind === "service";
    if (amount === null) continue;
    const row = { label: line.name, detail: formatCents(amount) };
    if (service) {
      serviceCount += 1;
      serviceCents += amount;
      services.push(row);
    } else {
      materialCount += 1;
      materialCents += amount;
      material.push(row);
    }
  }
  const purchaseRows = input.purchases.map((row) => ({ label: row.designation, detail: formatCents(row.orderCents) }));
  const purchaseCents = input.purchases.reduce((sum, row) => sum + row.orderCents, 0);
  const hourRows: AnswerRow[] = [];
  let hourCents = 0;
  let hourCount = 0;
  let daily = 0;
  for (const row of input.hours) {
    const amount = hourAmountCents(row);
    if (amount === null) {
      if (row.rateUnit === "journalier") daily += 1;
      continue;
    }
    hourCount += 1;
    hourCents += amount;
    hourRows.push({ label: `${row.label} · ${row.occurredOn}`, detail: formatCents(amount) });
  }
  const missing = [
    materialCount === 0 ? "Aucune vente de matériel confirmée." : "",
    serviceCount === 0 ? "Aucune prestation confirmée." : "",
    input.purchases.length === 0 ? "Aucun achat confirmé sur ce dossier." : "",
    hourCount === 0 ? "Aucune heure horaire confirmée sur ce dossier." : "",
    input.unconfirmedQuotes > 0
      ? `${input.unconfirmedQuotes} devis non confirmé${input.unconfirmedQuotes > 1 ? "s" : ""} n’entre${input.unconfirmedQuotes > 1 ? "nt" : ""} pas dans les ventes.`
      : "",
    daily === 1 ? "1 intervention à taux journalier n’est pas mélangée aux heures." : "",
    daily > 1 ? `${daily} interventions à taux journalier ne sont pas mélangées aux heures.` : "",
  ].filter(Boolean);
  return {
    title: "Rentabilité du dossier",
    period: "",
    filters: [input.projectName],
    measures: [
      { label: "Matériel", value: formatCents(materialCents) },
      { label: "Prestations", value: formatCents(serviceCents) },
      { label: "Achats", value: formatCents(purchaseCents) },
      { label: "Heures", value: formatCents(hourCents) },
    ],
    rows: [...material, ...services, ...purchaseRows, ...hourRows],
    sources: ["Commandes client confirmées", "Achats confirmés", "Interventions confirmées"],
    missing,
    method: PROFIT_METHOD,
  };
}

export function stockPacket(input: { products: StockProduct[]; lines: StockLine[] }): AnswerPacket {
  const priced = input.products.filter((product) => product.stockQty !== null && product.costCents !== null);
  const value = priced.reduce((sum, product) => sum + (product.stockQty ?? 0) * (product.costCents ?? 0), 0);
  const unpriced = input.products.filter((product) => product.stockQty !== null && product.costCents === null);
  const reservedLines = input.lines.filter((line) => line.open);
  const reserved = reservedLines.reduce((sum, line) => sum + line.quantity, 0);
  const byProject = new Map<string, number>();
  for (const line of reservedLines) byProject.set(line.projectName, (byProject.get(line.projectName) ?? 0) + line.quantity);
  return {
    title: "Stock atelier",
    period: "",
    filters: ["Dossiers ouverts"],
    measures: [
      { label: "Valeur", value: priced.length === 0 ? "non indiqué" : formatCents(value) },
      { label: "Réservée", value: String(reserved) },
    ],
    rows: [
      ...priced.map((product) => ({
        label: product.name,
        detail: `stock ${product.stockQty} · ${formatCents((product.stockQty ?? 0) * (product.costCents ?? 0))}`,
      })),
      ...[...byProject.entries()].map(([name, quantity]) => ({ label: name, detail: `quantité ${quantity}` })),
    ],
    sources: ["Fiches produit", "Lignes de dossier"],
    missing: [
      priced.length === 0 ? "Aucun stock atelier chiffré n’est écrit." : "",
      unpriced.length > 0 ? `${unpriced.length} produit${unpriced.length > 1 ? "s" : ""} en stock sans coût écrit n’entre${unpriced.length > 1 ? "nt" : ""} pas dans la valeur.` : "",
    ].filter(Boolean),
    method: STOCK_METHOD,
  };
}

export function receivedPacket(input: {
  purchases: ReceivedPurchase[];
  interventions: PlannedIntervention[];
  today: string;
}): AnswerPacket {
  const planned = new Set(
    input.interventions.filter((row) => row.occurredOn >= input.today).map((row) => row.projectId),
  );
  const kept = input.purchases
    .filter((row) => row.remainder === "clos")
    .filter((row) => !row.projectId || !planned.has(row.projectId))
    .sort((left, right) => left.designation.localeCompare(right.designation, "fr"));
  return {
    title: "Réceptions sans intervention",
    period: `au ${input.today}`,
    filters: ["Reliquat clos", "Sans intervention à venir"],
    measures: [{ label: "Réceptions", value: String(kept.length) }],
    rows: kept.map((row) => ({
      label: row.designation,
      detail: row.projectName || "sans dossier",
    })),
    sources: ["Achats confirmés", "Interventions confirmées"],
    missing: [kept.length === 0 ? "Aucune réception close n’est sans intervention planifiée." : ""],
    method: RECEIVED_METHOD,
  };
}

export function unrecoveredPacket(input: {
  projectName: string;
  purchases: UnrecoveredPurchase[];
  quoteNames: string[];
  notedReferences: string[];
}): AnswerPacket {
  const known = new Set([...input.quoteNames, ...input.notedReferences].map(fold).filter((name) => name.length >= 2));
  const missing = input.purchases.filter((row) => !known.has(fold(row.designation)));
  return {
    title: "Achats non repris",
    period: "",
    filters: [input.projectName, "Devis", "Pièces constatées"],
    measures: [{ label: "Absents", value: String(missing.length) }],
    rows: missing.map((row) => ({ label: row.designation, detail: "absent du devis et des pièces constatées" })),
    sources: ["Achats confirmés", "Lignes de devis", "Pièces constatées"],
    missing: [missing.length === 0 ? "Chaque désignation achetée est déjà sur le devis ou sur une pièce constatée." : "Aucune facture n’est créée."],
    method: UNRECOVERED_METHOD,
  };
}

export function dossierGapPacket(title: string, missing: string): AnswerPacket {
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

type AnswerRow = { label: string; detail: string };

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'");
}
