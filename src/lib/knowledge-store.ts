import { createHash } from "node:crypto";
import {
  rankKnowledge,
  recordFocus,
  type KnowledgeDoc,
  type RankedDoc,
  type SourceType,
} from "@/domain/knowledge";
import { prisma } from "@/lib/db";
import { embedWithOllama, getOllamaStatus } from "@/lib/ollama";

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
  const ranked = rankKnowledge(query, pool.length > 0 ? pool : docs, queryVector);
  return mode === "context" ? ranked.slice(0, 4) : ranked;
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
  const [clients, suppliers, products, projects, quotes, notes] = await Promise.all([
    prisma.client.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.product.findMany({ take: 500, include: { supplier: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ take: 500, orderBy: { createdAt: "desc" } }),
    prisma.quote.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { product: true } } },
    }),
    prisma.inboxItem.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
  ]);

  return [
    ...clients.map((client) =>
      doc("client", client.id, client.name, clientLine(client), clientBody(client)),
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
    ),
    ...products.map((product) =>
      doc(
        "product",
        product.id,
        product.name,
        [product.reference, product.supplier?.name].filter(Boolean).join(", "),
        [
          `Produit ${product.name}`,
          product.reference ? `Référence ${product.reference}` : "",
          product.unit ? `Unité ${product.unit}` : "",
          product.supplier ? `Fournisseur ${product.supplier.name}` : "",
          product.description,
        ]
          .filter(Boolean)
          .join("\n"),
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
          `Client ${project.primaryClient}`,
          `Statut ${project.status}`,
          project.nextAction ? `Prochaine action ${project.nextAction}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ),
    ...quotes.map((quote) => {
      const names = quote.lines.map((line) => line.product.name);
      return doc(
        "quote",
        quote.id,
        quote.title,
        names.join(", "),
        [`Devis ${quote.title}`, names.length ? `Produits ${names.join(", ")}` : ""]
          .filter(Boolean)
          .join("\n"),
      );
    }),
    ...notes.map((note) =>
      doc("inbox", note.id, "Note à classer", clip(note.body, 120), `À classer\n${clip(note.body, 800)}`),
    ),
  ];
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
