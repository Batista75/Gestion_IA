import { dayKey, inDayRange, periodGap } from "@/domain/board";
import { shownUnitCost, writtenCurrency } from "@/domain/article";
import { figuresFromSaleUnit, formatCents, saleLineFigures, saleOperationTotals, type SaleLineFigures } from "@/domain/pricing";
import { saleKindLabel, saleStatusLabel } from "@/domain/sale-line";
import { prisma } from "@/lib/db";

type MoneyLine = {
  name: string;
  quantity: number;
  costCents: number | null;
  saleUnitCents?: number | null;
  markupPercent: number;
  discountPercent: number;
};

export type Cell = { text: string; href?: string; download?: boolean };

export type ProducedDocument = {
  id: string;
  href: string;
  kind: string;
  type: string;
  date: Date;
  reference: string;
  party: string;
  projectName: string;
  title: string;
  ht: number | null;
  margin: number | null;
  status: string;
  statusLabel: string;
  billing: string;
  proof: string;
};

export type Listed = {
  headers: string[];
  rows: Cell[][];
};

function figuresOf(line: MoneyLine): SaleLineFigures {
  if (typeof line.saleUnitCents === "number") {
    return figuresFromSaleUnit(line.quantity, line.saleUnitCents, line.costCents);
  }
  try {
    return saleLineFigures(line);
  } catch {
    return {
      unitNetCents: null,
      unitListCents: null,
      lineCostCents: null,
      lineNetCents: null,
      lineMarginCents: null,
    };
  }
}

function totalsOf(kind: string, lines: MoneyLine[]): { ht: number | null; margin: number | null } {
  if (lines.length === 0) return { ht: null, margin: null };
  const figures = lines.map(figuresOf);
  const totals = saleOperationTotals(figures);
  if (totals.missing === lines.length) return { ht: null, margin: null };
  if (kind === "commande_fournisseur") return { ht: totals.costCents, margin: null };
  return { ht: totals.netCents, margin: totals.marginCents };
}

function blank(value: string): string {
  const text = value.trim();
  return text || "—";
}

function haystack(parts: string[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.join(" ").toLowerCase().includes(needle);
}

function dateLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR");
}

export async function loadProduced(): Promise<ProducedDocument[]> {
  const documents = await prisma.saleDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      lines: true,
      project: { include: { client: true, steps: true } },
    },
  });
  return documents.map((document) => {
    const money = totalsOf(document.kind, document.lines);
    const step = document.project.steps.find((item) => item.stepKey === "facturation");
    const party =
      document.kind === "commande_fournisseur"
        ? document.supplierName || document.project.primaryClient
        : document.project.client?.name || document.project.primaryClient;
    return {
      id: document.id,
      href: `/projets/${document.projectId}/documents/${document.id}`,
      kind: document.kind,
      type: saleKindLabel(document.kind),
      date: document.createdAt,
      reference: blank(document.project.reference),
      party: blank(party),
      projectName: document.project.name,
      title: document.title,
      ht: money.ht,
      margin: money.margin,
      status: document.status,
      statusLabel: saleStatusLabel(document.status),
      billing: step?.status === "fait" ? "Référence enregistrée" : "À facturer",
      proof: blank(step?.proofRef ?? ""),
    };
  });
}

function producedCells(document: ProducedDocument, amount: string): Cell[] {
  return [
    { text: document.type, href: document.href },
    { text: dateLabel(document.date) },
    { text: document.reference },
    { text: document.party },
    { text: document.projectName, href: document.href.split("/documents/")[0] },
    { text: amount },
    { text: document.statusLabel },
  ];
}

const producedHeaders = ["Type", "Date", "Réf.", "Client / fournisseur", "Projet", "Montant HT", "Situation"];

export async function listDocuments(query: string): Promise<Listed> {
  const [produced, received] = await Promise.all([
    loadProduced(),
    prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { project: true },
    }),
  ]);
  const rows: Cell[][] = [];
  for (const document of produced) {
    if (!haystack([document.type, document.reference, document.party, document.projectName, document.title, document.statusLabel], query)) {
      continue;
    }
    rows.push([
      ...producedCells(document, formatCents(document.ht)),
      { text: "Télécharger", href: `/api/ventes/${document.id}`, download: true },
    ]);
  }
  for (const quote of received) {
    const party = blank(quote.clientName || quote.supplierName);
    const reference = blank(quote.versionLabel);
    const title = quote.title;
    if (!haystack(["Devis reçu", party, reference, title, quote.statedTotalHt], query)) continue;
    rows.push([
      { text: "Devis reçu", href: quote.projectId ? `/projets/${quote.projectId}` : "/produits" },
      { text: dateLabel(quote.createdAt) },
      { text: reference },
      { text: party },
      { text: quote.project?.name || "—" , href: quote.projectId ? `/projets/${quote.projectId}` : undefined },
      { text: blank(quote.statedTotalHt) === "—" ? "non indiqué" : quote.statedTotalHt },
      { text: "Reçu" },
      {
        text: "Télécharger",
        href: quote.fileId ? `/api/pieces/${quote.fileId}` : `/api/devis-recus/${quote.id}`,
        download: true,
      },
    ]);
  }
  return { headers: [...producedHeaders, "Télécharger"], rows };
}

export async function listClientQuotes(query: string, situation: string, client: string): Promise<{
  listed: Listed;
  clients: string[];
  situations: string[];
}> {
  const documents = (await loadProduced()).filter((document) => document.kind === "devis");
  const clients = [...new Set(documents.map((document) => document.party))].sort((left, right) => left.localeCompare(right, "fr"));
  const situations = [...new Set(documents.map((document) => document.statusLabel))];
  const rows = documents.filter(
    (document) =>
      (!situation || document.statusLabel === situation) &&
      (!client || document.party === client) &&
      haystack([document.reference, document.party, document.projectName, document.title, document.statusLabel], query),
  );
  return {
    clients,
    situations,
    listed: {
      headers: producedHeaders,
      rows: rows.map((document) => producedCells(document, formatCents(document.ht))),
    },
  };
}

export async function listQuoteTable(query: string): Promise<Listed> {
  const { listed } = await listClientQuotes(query, "", "");
  return listed;
}

export async function listLines(query: string): Promise<Listed> {
  const documents = await prisma.saleDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 400,
    include: { lines: true, project: { include: { client: true } } },
  });
  const rows: Cell[][] = [];
  for (const document of documents) {
    for (const line of document.lines) {
      const money = totalsOf(document.kind, [line]);
      const party =
        document.kind === "commande_fournisseur"
          ? line.supplierName || document.supplierName
          : document.project.client?.name || document.project.primaryClient;
      if (!haystack([saleKindLabel(document.kind), line.name, line.supplierName, party, document.project.name], query)) {
        continue;
      }
      rows.push([
        { text: document.project.reference.trim() || "—", href: `/projets/${document.projectId}/documents/${document.id}` },
        { text: saleKindLabel(document.kind) },
        { text: line.kind === "service" ? "Service" : "Produit" },
        { text: line.name },
        { text: String(line.quantity) },
        { text: formatCents(money.ht) },
        { text: blank(party) },
      ]);
    }
  }
  return {
    headers: ["Réf.", "Type", "Famille", "Désignation", "Quantité", "Montant HT", "Client / fournisseur"],
    rows,
  };
}

export async function listDeadlines(query: string): Promise<Listed> {
  const orders = (await loadProduced()).filter(
    (document) =>
      document.kind === "commande_client" &&
      haystack([document.party, document.projectName, document.reference, document.billing, document.proof], query),
  );
  return {
    headers: ["Client", "Projet", "Réf.", "Montant HT", "Facturation", "Référence saisie", "Paiement"],
    rows: orders.map((document) => [
      { text: document.party, href: document.href },
      { text: document.projectName },
      { text: document.reference },
      { text: formatCents(document.ht) },
      { text: document.billing },
      { text: document.proof },
      { text: "Non suivi" },
    ]),
  };
}

export async function listTexts(query: string): Promise<Listed> {
  const [quotes, products, projects] = await Promise.all([
    prisma.quote.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { title: true, conditions: true, projectId: true } }),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 200, select: { name: true, description: true } }),
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, deliveryNote: true } }),
  ]);
  const rows: Cell[][] = [];
  for (const quote of quotes) {
    const text = quote.conditions.trim();
    if (!text || !haystack([quote.title, text], query)) continue;
    rows.push([
      { text: "Conditions de devis", href: quote.projectId ? `/projets/${quote.projectId}` : "/produits" },
      { text: quote.title },
      { text: text.slice(0, 180) },
    ]);
  }
  for (const product of products) {
    const text = product.description.trim();
    if (!text || !haystack([product.name, text], query)) continue;
    rows.push([
      { text: "Article", href: "/produits" },
      { text: product.name },
      { text: text.slice(0, 180) },
    ]);
  }
  for (const project of projects) {
    const text = project.deliveryNote.trim();
    if (!text || !haystack([project.name, text], query)) continue;
    rows.push([
      { text: "Consigne de livraison", href: `/projets/${project.id}` },
      { text: project.name },
      { text: text.slice(0, 180) },
    ]);
  }
  return { headers: ["Origine", "Titre", "Texte"], rows };
}

export type SupplierGroup = {
  supplier: string;
  rows: Cell[][];
};

export async function listGroups(query: string): Promise<SupplierGroup[]> {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    take: 500,
    include: { supplier: true },
  });
  const groups = new Map<string, Cell[][]>();
  for (const product of products) {
    const supplier = product.supplier?.name.trim() || "Sans fournisseur";
    if (!haystack([supplier, product.name, product.reference, product.statedPrice], query)) continue;
    const bucket = groups.get(supplier) ?? [];
    bucket.push([
      { text: blank(product.reference), href: "/produits" },
      { text: product.name },
      { text: product.kind === "service" ? "Service" : "Produit" },
      { text: shownUnitCost(product.costStated, [product.statedPrice]) || "non indiqué" },
      { text: product.currency.trim() || writtenCurrency(product.costStated || product.statedPrice) || "non indiqué" },
      { text: product.createdAt.toLocaleDateString("fr-FR") },
    ]);
    groups.set(supplier, bucket);
  }
  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "fr"))
    .map(([supplier, rows]) => ({ supplier, rows }));
}

export async function listJournal(query: string, from: string, to: string, sales: boolean): Promise<Listed> {
  const documents = sales
    ? (await loadProduced()).filter(
        (document) =>
          (document.kind === "devis" || document.kind === "commande_client") &&
          inDayRange(document.date, from, to) &&
          haystack([document.type, document.party, document.projectName, document.reference], query),
      )
    : [];
  return {
    headers: ["Date", "Type", "Client", "Projet", "Réf.", "Montant HT"],
    rows: documents.map((document) => [
      { text: dateLabel(document.date), href: document.href },
      { text: document.type },
      { text: document.party },
      { text: document.projectName },
      { text: document.reference },
      { text: formatCents(document.ht) },
    ]),
  };
}

export type PeriodFigures = {
  quotes: number;
  orders: number;
  ht: number | null;
  margin: number | null;
};

export function figuresBetween(documents: ProducedDocument[], from: string, to: string): PeriodFigures {
  const inside = documents.filter((document) => inDayRange(document.date, from, to));
  const orders = inside.filter((document) => document.kind === "commande_client");
  const quotes = inside.filter((document) => document.kind === "devis" && document.status !== "non_abouti");
  const sum = (rows: ProducedDocument[], pick: (document: ProducedDocument) => number | null) => {
    const values = rows.map(pick).filter((value): value is number => value !== null);
    return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
  };
  return {
    quotes: quotes.length,
    orders: orders.length,
    ht: sum(orders, (document) => document.ht),
    margin: sum(orders, (document) => document.margin),
  };
}

export function compareCounts(left: number, right: number): { left: string; right: string; gap: string; percent: string } {
  const result = periodGap(left, right);
  return { left: String(left), right: String(right), gap: String(result.gap), percent: result.percent };
}

export function compareMoney(left: number | null, right: number | null): { left: string; right: string; gap: string; percent: string } {
  if (left === null || right === null) {
    return { left: formatCents(left), right: formatCents(right), gap: "non indiqué", percent: "—" };
  }
  const result = periodGap(left, right);
  return {
    left: formatCents(left),
    right: formatCents(right),
    gap: formatCents(result.gap),
    percent: result.percent,
  };
}

export type Rank = { name: string; quantity: number; ht: number; margin: number };

export async function loadDashboard() {
  const [documents, projects] = await Promise.all([
    loadProduced(),
    prisma.project.count(),
  ]);
  const pending = documents.filter((document) => document.kind === "devis" && document.status === "en_cours");
  const orders = documents.filter((document) => document.kind === "commande_client");
  const unbilled = orders.filter((document) => document.billing === "À facturer");
  const htValues = orders.map((document) => document.ht).filter((value): value is number => value !== null);
  const revenue = htValues.length === 0 ? null : htValues.reduce((total, value) => total + value, 0);
  const ranks = new Map<string, Rank>();
  const clients = new Map<string, number>();
  const stored = await prisma.saleDocument.findMany({
    where: { kind: "commande_client" },
    include: { lines: true, project: { include: { client: true } } },
    take: 500,
  });
  for (const document of stored) {
    const party = document.project.client?.name || document.project.primaryClient || "Client non nommé";
    for (const line of document.lines) {
      const money = totalsOf("commande_client", [line]);
      const current = ranks.get(line.name) ?? { name: line.name, quantity: 0, ht: 0, margin: 0 };
      current.quantity += line.quantity;
      if (money.ht !== null) current.ht += money.ht;
      if (money.margin !== null) current.margin += money.margin;
      ranks.set(line.name, current);
      if (money.ht !== null) clients.set(party, (clients.get(party) ?? 0) + money.ht);
    }
  }
  const byHt = [...ranks.values()].sort((left, right) => right.ht - left.ht).slice(0, 5);
  const byVolume = [...ranks.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 5);
  const byMargin = [...ranks.values()].sort((left, right) => right.margin - left.margin).slice(0, 5);
  const byClient = [...clients.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, ht]) => ({ name, ht }));
  return {
    projects,
    pending: pending.length,
    orders: orders.length,
    unbilled: unbilled.length,
    revenue,
    byHt,
    byVolume,
    byMargin,
    byClient,
  };
}
