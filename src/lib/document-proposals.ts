import { nameKey } from "@/domain/catalog";
import {
  proposeFromReading,
  type DirectorySnapshot,
  type DocumentProposalDraft,
  type DocumentReading,
  type ProposedAction,
} from "@/domain/offer-versions";
import { sourceLabel } from "@/domain/knowledge";
import { searchKnowledge } from "@/lib/knowledge-store";
import { prisma } from "@/lib/db";
import { recordOfferVersion } from "@/lib/pieces";

export async function queueDocumentProposals(
  files: Array<{ id: string; originalName: string; reading: DocumentReading }>,
  context = "",
): Promise<number> {
  const interesting = files.filter((file) => file.reading.kind !== "autre");
  if (interesting.length === 0) return 0;
  const directory = await loadDirectory();
  const hits = await ragHits(interesting);
  let count = 0;
  for (const file of interesting) {
    const draft = proposeFromReading(file.reading, file.originalName, directory, hits, context);
    if (!draft) continue;
    await prisma.documentProposal.create({
      data: {
        fileId: file.id,
        kind: draft.kind,
        title: draft.title,
        summary: draft.summary,
        payload: draft,
      },
    });
    count += 1;
  }
  return count;
}

export async function confirmDocumentProposal(id: string): Promise<{ ok: boolean; message: string }> {
  const row = await prisma.documentProposal.findUnique({
    where: { id },
    include: { file: true },
  });
  if (!row || row.status !== "en_attente") {
    return { ok: false, message: "Cette proposition n’est plus en attente." };
  }
  const draft = readDraft(row.payload);
  if (!draft) {
    return { ok: false, message: "La proposition est illisible." };
  }
  const filename = row.file?.originalName ?? row.title;
  const notes: string[] = [];
  for (const action of draft.actions) {
    notes.push(await applyAction(action, row.fileId, filename, draft.kind));
  }
  await prisma.documentProposal.update({
    where: { id },
    data: { status: "confirmee" },
  });
  const done = notes.filter(Boolean);
  return {
    ok: true,
    message: done.length > 0 ? done.join(" ") : "Pièce confirmée. Aucune fiche nouvelle.",
  };
}

export async function dismissDocumentProposal(id: string): Promise<{ ok: boolean; message: string }> {
  const row = await prisma.documentProposal.findUnique({ where: { id } });
  if (!row || row.status !== "en_attente") {
    return { ok: false, message: "Cette proposition n’est plus en attente." };
  }
  await prisma.documentProposal.update({
    where: { id },
    data: { status: "ecartee" },
  });
  return { ok: true, message: "Proposition écartée. Le fichier reste dans À classer." };
}

async function applyAction(
  action: ProposedAction,
  fileId: string | null,
  filename: string,
  source: string,
): Promise<string> {
  switch (action.type) {
    case "create_client":
      return createClient(action.name, filename);
    case "create_supplier":
      return createSupplier(action.name);
    case "create_product":
      return createProduct(action);
    case "add_quote_version": {
      const inserted = await recordOfferVersion(action.offer, fileId, source === "tarif" ? "tarif" : "devis");
      return inserted
        ? `Version ${action.offer.versionLabel} ajoutée.`
        : `Version ${action.offer.versionLabel} déjà enregistrée.`;
    }
    case "record_demand": {
      await prisma.demand.create({
        data: {
          title: action.title,
          reference: action.reference,
          clientName: action.clientName,
          supplierName: action.supplierName,
          fileId: fileId ?? undefined,
          status: "ouverte",
        },
      });
      return `Demande « ${action.title} » ouverte.`;
    }
    case "mark_demand": {
      const demand = await prisma.demand.findFirst({
        where: { title: action.title, status: { not: "offre reçue" } },
        orderBy: { createdAt: "desc" },
      });
      if (!demand) return "";
      await prisma.demand.update({
        where: { id: demand.id },
        data: { status: action.status },
      });
      return `Demande « ${demand.title} » mise à jour : offre reçue.`;
    }
  }
}

async function createClient(name: string, filename: string): Promise<string> {
  const trimmed = name.trim().slice(0, 160);
  const key = nameKey(trimmed);
  const existing = await prisma.client.findUnique({ where: { nameKey: key } });
  if (existing) return `Client « ${existing.name} » déjà au répertoire.`;
  await prisma.client.create({
    data: {
      name: trimmed,
      nameKey: key,
      notes: `Fiche créée depuis la pièce « ${filename} ». À compléter.`,
    },
  });
  return `Client « ${trimmed} » créé.`;
}

async function createSupplier(name: string): Promise<string> {
  const trimmed = name.trim().slice(0, 160);
  const key = nameKey(trimmed);
  const existing = await prisma.supplier.findUnique({ where: { nameKey: key } });
  if (existing) return `Fournisseur « ${existing.name} » déjà au répertoire.`;
  await prisma.supplier.create({ data: { name: trimmed, nameKey: key } });
  return `Fournisseur « ${trimmed} » créé.`;
}

async function createProduct(action: Extract<ProposedAction, { type: "create_product" }>): Promise<string> {
  const trimmed = action.name.trim().slice(0, 120);
  const key = nameKey(trimmed);
  const costStated = (action.costStated ?? "").slice(0, 80);
  const currency = (action.currency ?? "").slice(0, 8);
  const kind = action.kind === "service" ? "service" : "produit";
  const existing = await prisma.product.findUnique({ where: { nameKey: key } });
  if (existing) {
    const data: { costStated?: string; currency?: string; kind?: string; reference?: string } = {};
    if (!existing.costStated && costStated) data.costStated = costStated;
    if (!existing.currency && currency) data.currency = currency;
    if (existing.kind !== "service" && kind === "service") data.kind = "service";
    if (!existing.reference && action.reference) data.reference = action.reference.slice(0, 60);
    if (Object.keys(data).length > 0) {
      await prisma.product.update({ where: { id: existing.id }, data });
    }
    return `Produit « ${existing.name} » déjà au catalogue.`;
  }
  const supplierId = await supplierIdOf(action.supplierName);
  await prisma.product.create({
    data: {
      name: trimmed,
      nameKey: key,
      reference: action.reference.slice(0, 60),
      source: action.source.slice(0, 40) || "manuel",
      kind,
      costStated,
      currency,
      supplierId,
    },
  });
  return `Produit « ${trimmed} » créé.`;
}

async function supplierIdOf(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;
  const key = nameKey(trimmed.slice(0, 160));
  const existing = await prisma.supplier.findUnique({ where: { nameKey: key } });
  return existing?.id ?? null;
}

async function loadDirectory(): Promise<DirectorySnapshot> {
  const [clients, suppliers, products, quotes, demands, projects] = await Promise.all([
    prisma.client.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.product.findMany({ take: 500, orderBy: { name: "asc" } }),
    prisma.quote.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { product: true } } },
    }),
    prisma.demand.findMany({ take: 200, orderBy: { updatedAt: "desc" } }),
    prisma.project.findMany({ take: 200, orderBy: { name: "asc" } }),
  ]);
  return {
    clients: clients.map((client) => client.name),
    suppliers: suppliers.map((supplier) => supplier.name),
    products: products.map((product) => ({ name: product.name, reference: product.reference })),
    quotes: quotes.map((quote) => ({
      title: quote.title,
      versionLabel: quote.versionLabel,
      supplierName: quote.supplierName,
      fingerprint: quote.fingerprint ?? "",
      lines: quote.lines.map((line) => ({
        product: line.product.name,
        statedPrice: line.statedPrice,
        conditions: line.conditions,
      })),
    })),
    demands: demands.map((demand) => ({
      title: demand.title,
      supplierName: demand.supplierName,
      clientName: demand.clientName,
      status: demand.status,
    })),
    projects: projects.map((project) => project.name),
  };
}

async function ragHits(
  files: Array<{ reading: DocumentReading }>,
): Promise<Array<{ label: string; title: string }>> {
  const query = files
    .map((file) =>
      [
        file.reading.parties.clientName,
        file.reading.parties.supplierName,
        ...file.reading.pricedLines.map((line) => line.product),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .slice(0, 500);
  if (query.trim().length < 3) return [];
  try {
    const found = await searchKnowledge(query, "context");
    return found.map((doc) => ({ label: sourceLabel(doc.sourceType), title: doc.title }));
  } catch {
    return [];
  }
}

function readDraft(payload: unknown): DocumentProposalDraft | null {
  if (!payload || typeof payload !== "object") return null;
  const draft = payload as Partial<DocumentProposalDraft>;
  if (typeof draft.kind !== "string" || typeof draft.summary !== "string" || !Array.isArray(draft.actions)) {
    return null;
  }
  return draft as DocumentProposalDraft;
}
