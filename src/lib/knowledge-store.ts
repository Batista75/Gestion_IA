import { createHash } from "node:crypto";
import {
  rankKnowledge,
  recallCandidates,
  recordFocus,
  rerankPassage,
  selectReranked,
  type KnowledgeDoc,
  type RankedDoc,
  type SourceType,
} from "@/domain/knowledge";
import { prisma } from "@/lib/db";
import { embedWithOllama, getOllamaStatus, rerankWithOllama } from "@/lib/ollama";

const EMBED_BATCH = 20;

export async function searchKnowledge(
  query: string,
  mode: "lookup" | "directory" | "context",
): Promise<RankedDoc[]> {
  const docs = await syncKnowledge();
  const focus = recordFocus(query);
  if (mode === "directory" && focus) {
    return docs
      .filter((doc) => doc.sourceType === focus)
      .slice(0, 8)
      .map((doc) => ({ ...doc, score: 1 }));
  }

  const status = await getOllamaStatus();
  const queryVector = status.embedModel
    ? await embedQuery(status.embedModel, query, docs)
    : null;
  const pool = focus ? docs.filter((doc) => doc.sourceType === focus) : docs;
  const source = pool.length > 0 ? pool : docs;
  const limit = mode === "context" ? 4 : 5;
  const wide = recallCandidates(query, source, queryVector, 12);
  const reranked = status.rerankModel
    ? await orderByReranker(status.rerankModel, query, wide, limit)
    : null;
  if (reranked !== null) return reranked;
  return rankKnowledge(query, source, queryVector, limit);
}

async function orderByReranker(
  model: string,
  query: string,
  docs: RankedDoc[],
  limit: number,
): Promise<RankedDoc[] | null> {
  const scores = await rerankWithOllama(
    model,
    query,
    docs.map((doc) => rerankPassage(query, doc)),
  );
  if (!scores) return null;
  return selectReranked(docs, scores, limit);
}

async function embedQuery(
  model: string,
  query: string,
  docs: KnowledgeDoc[],
): Promise<number[] | null> {
  const pending = docs
    .filter((doc) => !doc.embedding || doc.embedding.length === 0)
    .slice(0, EMBED_BATCH);
  try {
    if (pending.length > 0) {
      const vectors = await embedWithOllama(
        model,
        pending.map((doc) => `${doc.title}\n${doc.body}`),
      );
      await Promise.all(
        pending.map((doc, index) =>
          prisma.knowledgeChunk.update({
            where: { sourceType_sourceId: { sourceType: doc.sourceType, sourceId: doc.sourceId } },
            data: { embedding: vectors[index] ?? [] },
          }),
        ),
      );
      pending.forEach((doc, index) => {
        doc.embedding = vectors[index] ?? [];
      });
    }
    const [queryVector] = await embedWithOllama(model, [query]);
    return queryVector ?? null;
  } catch {
    return null;
  }
}

async function syncKnowledge(): Promise<KnowledgeDoc[]> {
  const docs = await loadDocs();
  const current = await prisma.knowledgeChunk.findMany();
  const byKey = new Map(current.map((row) => [`${row.sourceType}:${row.sourceId}`, row]));
  const seen = new Set<string>();

  for (const doc of docs) {
    const key = `${doc.sourceType}:${doc.sourceId}`;
    seen.add(key);
    const contentHash = createHash("sha256").update(doc.body).digest("hex");
    const row = byKey.get(key);
    if (!row) {
      await prisma.knowledgeChunk.create({
        data: {
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
          title: doc.title,
          summary: doc.summary,
          body: doc.body,
          contentHash,
          embedding: [],
        },
      });
      doc.embedding = [];
      continue;
    }
    doc.embedding = vectorOf(row.embedding);
    if (row.contentHash !== contentHash || row.title !== doc.title || row.summary !== doc.summary) {
      await prisma.knowledgeChunk.update({
        where: { id: row.id },
        data: { title: doc.title, summary: doc.summary, body: doc.body, contentHash, embedding: [] },
      });
      doc.embedding = [];
    }
  }

  for (const row of current) {
    if (!seen.has(`${row.sourceType}:${row.sourceId}`)) {
      await prisma.knowledgeChunk.delete({ where: { id: row.id } });
    }
  }
  return docs;
}

async function loadDocs(): Promise<KnowledgeDoc[]> {
  const [clients, suppliers, products, projects, quotes, notes, files, demands, events] = await Promise.all([
    prisma.client.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      take: 500,
      include: { supplier: true, lines: { include: { quote: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      include: { events: { orderBy: { createdAt: "asc" }, take: 12 } },
    }),
    prisma.quote.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { product: true } } },
    }),
    prisma.inboxItem.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { files: true },
    }),
    prisma.storedFile.findMany({ take: 200, orderBy: { createdAt: "desc" } }),
    prisma.demand.findMany({ take: 200, orderBy: { updatedAt: "desc" } }),
    prisma.recordEvent.findMany({ orderBy: { createdAt: "desc" }, take: 400 }),
  ]);
  const history = historyLines(events);

  return [
    ...clients.map((client) =>
      doc(
        "client",
        client.id,
        client.name,
        clientLine(client),
        withHistory(clientBody(client), history.get(`client:${client.id}`) ?? []),
      ),
    ),
    ...suppliers.map((supplier) =>
      doc(
        "supplier",
        supplier.id,
        supplier.name,
        [supplier.email, supplier.phone].filter(Boolean).join(", "),
        [
          `Fournisseur ${supplier.name}`,
          supplier.siren ? `SIREN ${supplier.siren}` : "",
          supplier.email ? `E-mail ${supplier.email}` : "",
          supplier.phone ? `Téléphone ${supplier.phone}` : "",
          supplier.address ? `Adresse ${supplier.address}` : "",
          supplier.notes,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ).map((entry) => ({
      ...entry,
      body: withHistory(entry.body, history.get(`supplier:${entry.sourceId}`) ?? []),
    })),
    ...products.map((product) =>
      doc(
        "product",
        product.id,
        product.name,
        [product.reference, product.supplier?.name].filter(Boolean).join(", "),
        withHistory(productBody(product), history.get(`product:${product.id}`) ?? []),
      ),
    ),
    ...projects.map((project) =>
      doc(
        "project",
        project.id,
        project.name,
        [project.primaryClient, project.status].filter(Boolean).join(", "),
        [
          `Projet ${project.name}`,
          project.reference ? `Référence ${project.reference}` : "",
          `Client ${project.primaryClient}`,
          `Statut ${project.status}`,
          project.purpose ? `Le projet consiste à ${project.purpose}` : "",
          project.budgetStated ? `Budget indiqué ${project.budgetStated}` : "",
          project.nextAction ? `Prochaine action ${project.nextAction}` : "",
          project.events.length ? "Actualité :" : "",
          ...project.events.map((event) => event.body),
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ),
    ...quotes.map((quote) => {
      const names = quote.lines.map((line) => line.product.name);
      const label = quote.versionLabel || quote.title;
      return doc(
        "quote",
        quote.id,
        quote.title,
        [label, names.join(", ")].filter(Boolean).join(" · "),
        quoteBody(quote),
      );
    }),
    ...files.map((file) =>
      doc(
        "piece",
        file.id,
        file.originalName,
        file.kind,
        file.enrichment || `Pièce : ${file.originalName}\nFichier conservé.`,
      ),
    ),
    ...demands.map((demand) =>
      doc(
        "demand",
        demand.id,
        demand.title,
        [demand.status, demand.supplierName, demand.clientName].filter(Boolean).join(", "),
        [
          `Demande ${demand.title}`,
          demand.reference ? `Référence ${demand.reference}` : "",
          demand.clientName ? `Client ${demand.clientName}` : "",
          demand.supplierName ? `Fournisseur ${demand.supplierName}` : "",
          `Statut ${demand.status}`,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ),
    ...notes.map((note) =>
      doc(
        "inbox",
        note.id,
        "Note à classer",
        clip(note.body, 120),
        [
          "À classer",
          clip(note.body, 800),
          note.files.length
            ? `Fichiers : ${note.files.map((file) => file.originalName).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ),
  ];
}

function productBody(product: {
  name: string;
  reference: string;
  unit: string;
  description: string;
  statedPrice: string;
  currency: string;
  vatNote: string;
  kind: string;
  supplier: { name: string } | null;
  lines: Array<{
    statedPrice: string;
    conditions: string;
    quote: {
      title: string;
      versionLabel: string;
      issuedOn: string;
      supplierName: string;
      createdAt: Date;
    };
  }>;
}): string {
  const versions = [...product.lines]
    .sort((left, right) => right.quote.createdAt.getTime() - left.quote.createdAt.getTime())
    .map((line) => versionSentence(line));
  return [
    product.kind === "service" ? `Service ${product.name}` : `Produit ${product.name}`,
    product.reference ? `Référence ${product.reference}` : "",
    product.unit ? `Unité ${product.unit}` : "",
    product.statedPrice ? `Prix unitaire indiqué ${product.statedPrice}` : "",
    product.vatNote ? `TVA indiquée ${product.vatNote}` : "",
    product.supplier ? `Fournisseur ${product.supplier.name}` : "",
    product.description,
    versions.length
      ? "Versions de devis conservées à part, sans fusion des prix ni des conditions :"
      : "",
    ...versions,
  ]
    .filter(Boolean)
    .join("\n");
}

function quoteBody(quote: {
  title: string;
  versionLabel: string;
  issuedOn: string;
  supplierName: string;
  currency: string;
  statedTotalHt: string;
  vatMention: string;
  lines: Array<{ statedPrice: string; conditions: string; product: { name: string; reference: string } }>;
}): string {
  const lines = quote.lines.map((line) => versionSentence({ ...line, quote }));
  return [
    `Devis ${quote.title}`,
    quote.versionLabel ? `Version ${quote.versionLabel}` : "",
    quote.issuedOn ? `Date ${quote.issuedOn}` : "",
    quote.currency ? `Devise ${quote.currency}` : "",
    quote.statedTotalHt ? `Total HT indiqué ${quote.statedTotalHt}` : "",
    quote.vatMention ? quote.vatMention : "",
    quote.supplierName ? `Fournisseur ${quote.supplierName}` : "",
    "Cette version est conservée à part. Elle ne remplace pas un autre devis du même produit.",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

function versionSentence(line: {
  statedPrice: string;
  conditions: string;
  quote: { title: string; versionLabel: string; supplierName: string };
  product?: { name: string; reference: string };
}): string {
  const label = line.quote.versionLabel || line.quote.title;
  const product = line.product
    ? `${line.product.name}${line.product.reference ? ` (${line.product.reference})` : ""}`
    : "";
  const price = line.statedPrice
    ? `prix indiqué ${line.statedPrice}`
    : "prix non indiqué sur cette version";
  return ["-", product, label, line.quote.supplierName, price, line.conditions ? `conditions : ${line.conditions}` : ""]
    .filter(Boolean)
    .join(" — ")
    .replace(/^- — /, "- ");
}

function clientLine(client: {
  kind: string;
  country: string;
  city: string;
  phone: string;
  email: string;
}): string {
  const kind = client.kind === "particulier" ? "Particulier" : client.kind === "entreprise" ? "Entreprise" : "Non qualifié";
  return [kind, client.country, client.city, client.phone || client.email].filter(Boolean).join(", ");
}

function clientBody(client: {
  name: string;
  kind: string;
  civility: string;
  tradeName: string;
  legalForm: string;
  country: string;
  address: string;
  postalCode: string;
  city: string;
  siren: string;
  siret: string;
  vatNumber: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  notes: string;
}): string {
  const kind = client.kind === "particulier" ? "Particulier" : client.kind === "entreprise" ? "Entreprise" : "";
  return [
    `Client ${client.name}`,
    kind,
    client.civility,
    client.tradeName ? `Enseigne ${client.tradeName}` : "",
    client.legalForm ? `Forme ${client.legalForm}` : "",
    client.country ? `Pays ${client.country}` : "",
    client.address ? `Adresse ${[client.address, client.postalCode, client.city].filter(Boolean).join(" ")}` : "",
    client.siren ? `SIREN ${client.siren}` : "",
    client.siret ? `SIRET ${client.siret}` : "",
    client.vatNumber ? `TVA ${client.vatNumber}` : "",
    client.contactName
      ? `Contact ${[client.contactName, client.contactRole].filter(Boolean).join(", ")}`
      : "",
    client.email ? `E-mail ${client.email}` : "",
    client.phone ? `Téléphone ${client.phone}` : "",
    client.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

function historyLines(
  events: Array<{ entityType: string; entityId: string; createdAt: Date; summary: string; source: string }>,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const event of events) {
    const key = `${event.entityType}:${event.entityId}`;
    const lines = grouped.get(key) ?? [];
    if (lines.length >= 5) continue;
    const when = event.createdAt.toLocaleString("fr-FR");
    const origin = event.source === "assistant" ? "assistant" : event.source === "formulaire" ? "formulaire" : "application";
    lines.push(`${when} · ${origin} · ${event.summary}`);
    grouped.set(key, lines);
  }
  return grouped;
}

function withHistory(body: string, lines: string[]): string {
  if (lines.length === 0) return body;
  return `${body}\nModifications\n${lines.join("\n")}`;
}

function doc(
  sourceType: SourceType,
  sourceId: string,
  title: string,
  summary: string,
  body: string,
): KnowledgeDoc {
  return { sourceType, sourceId, title, summary, body };
}

function vectorOf(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "number")) return null;
  return value;
}

function clip(value: string, max: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
