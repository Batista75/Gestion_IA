import { documentBody } from "@/domain/document-chunks";
import { quotedItems, discountConflict, negotiatedDiscount } from "@/domain/hybrid-quote";
import { foldText, rankKnowledge, uniqueNameMatch, type KnowledgeDoc } from "@/domain/knowledge";
import { catalogUnitCents, centsFromStated, formatCents } from "@/domain/pricing";
import { prisma } from "@/lib/db";
import { withChangeSource } from "@/lib/change-source";
import { withGpuLane } from "@/lib/gpu-lane";
import { embedWithOllama, getOllamaStatus } from "@/lib/ollama";

export type HybridSource = { label: string; title: string };

export async function readClientAgreements(clientId: string): Promise<{ reply: string; sources: HybridSource[] }> {
  if (!clientId.trim()) {
    return { reply: "Le filtre client est obligatoire. Aucune condition n’est lue.", sources: [] };
  }
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) return { reply: "Ce client est introuvable. Aucune condition n’est lue.", sources: [] };
  const agreements = await clientAgreementDocs(client.id);
  if (agreements.length === 0) {
    return { reply: `Aucune condition commerciale indexée pour ${client.name}.`, sources: [] };
  }
  return {
    sources: agreements.map((doc) => ({ label: "Conditions", title: doc.title })),
    reply: agreements.map((doc) => `${doc.title}\n${doc.body.slice(0, 500)}`).join("\n\n"),
  };
}

export async function prepareHybridQuote(text: string): Promise<{
  reply: string;
  wrote: boolean;
  sources: HybridSource[];
}> {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, notes: true } });
  const clientName = uniqueNameMatch(text, clients.map((client) => client.name));
  if (!clientName) {
    return {
      wrote: false,
      sources: [],
      reply: clients.length === 0
        ? "Aucun client n’est au répertoire. Le devis n’est pas préparé."
        : "Nommez un seul client déjà enregistré. Aucune recherche de conditions n’est lancée sans lui.",
    };
  }
  const client = clients.find((item) => item.name === clientName);
  if (!client) {
    return { wrote: false, sources: [], reply: "Ce client est introuvable." };
  }
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      reference: true,
      statedPrice: true,
      costStated: true,
      kind: true,
      stockQty: true,
      unit: true,
    },
  });
  const items = quotedItems(text, products.map((product) => ({ name: product.name, reference: product.reference })));
  if (items.length === 0) {
    return {
      wrote: false,
      sources: [],
      reply: `Aucun article du catalogue n’est cité pour ${client.name}. Le devis n’est pas créé.`,
    };
  }
  const agreements = await clientAgreementDocs(client.id);
  const clauseText = agreements.map((doc) => doc.body).join("\n");
  const conflict = discountConflict(clauseText);
  const discount = conflict ? null : negotiatedDiscount(clauseText);
  const ranked = await rankClientDocs(agreements, text);
  const cited = ranked.length > 0 ? ranked : agreements.filter((doc) => /remise/i.test(doc.body));
  const sources = cited.slice(0, 5).map((doc) => ({ label: "Conditions", title: doc.title }));
  const lines: string[] = [];
  const draftLines: Array<{
    name: string;
    kind: string;
    quantity: number;
    costCents: number | null;
    saleUnitCents: number;
  }> = [];
  for (const item of items) {
    const product = products.find((candidate) => foldText(candidate.name) === foldText(item.name));
    if (!product) continue;
    const catalog = centsFromStated(product.statedPrice);
    const stock = product.stockQty === null ? "stock non indiqué" : `stock ${product.stockQty}`;
    if (catalog === null) {
      lines.push(`${product.name} : prix catalogue non indiqué, ligne non chiffrée. ${stock}.`);
      continue;
    }
    if (discount === null && conflict) {
      lines.push(`${product.name} : plusieurs remises dans les conditions de ${client.name}, aucune n’est appliquée.`);
      continue;
    }
    const unit = catalogUnitCents(catalog, discount ?? 0);
    const priced = formatCents(unit * item.quantity);
    const remise = discount === null ? "aucune remise écrite" : `remise ${discount} %`;
    const short = product.stockQty !== null && item.quantity > product.stockQty ? " Quantité supérieure au stock." : "";
    lines.push(
      `${item.quantity} × ${product.name} · catalogue ${formatCents(catalog)} · ${remise} · HT ${priced}. ${stock}.${short}`,
    );
    draftLines.push({
      name: product.name,
      kind: product.kind === "service" ? "service" : "produit",
      quantity: item.quantity,
      costCents: centsFromStated(product.costStated),
      saleUnitCents: unit,
    });
  }
  if (draftLines.length === 0) {
    return {
      wrote: false,
      sources,
      reply: [`Devis non créé pour ${client.name}.`, ...lines].join("\n"),
    };
  }
  const projects = await prisma.project.findMany({
    where: { clientId: client.id },
    select: { id: true, name: true },
  });
  const named = uniqueNameMatch(text, projects.map((project) => project.name));
  const project = named
    ? projects.find((item) => item.name === named) ?? null
    : projects.length === 1
      ? projects[0]
      : null;
  if (!project) {
    const hint = projects.length === 0
      ? "Aucun dossier n’est ouvert pour ce client."
      : `Plusieurs dossiers existent : ${projects.map((item) => item.name).join(", ")}. Nommez-en un.`;
    return {
      wrote: false,
      sources,
      reply: [`${hint} Le brouillon n’est pas enregistré.`, ...lines].join("\n"),
    };
  }
  const total = draftLines.reduce((sum, line) => sum + line.saleUnitCents * line.quantity, 0);
  const created = await withChangeSource("assistant", async () => {
    const document = await prisma.saleDocument.create({
      data: {
        projectId: project.id,
        kind: "devis",
        status: "brouillon",
        title: `Devis ${client.name}`,
        lines: {
          create: draftLines.map((line) => ({
            name: line.name,
            kind: line.kind,
            quantity: line.quantity,
            costCents: line.costCents,
            saleUnitCents: line.saleUnitCents,
            markupPercent: 0,
            discountPercent: discount ?? 0,
          })),
        },
      },
    });
    await prisma.projectEvent.create({
      data: {
        projectId: project.id,
        kind: "devis",
        body: `Brouillon de devis pour ${client.name}. Total HT ${formatCents(total)}.`,
      },
    });
    return document.id;
  });
  return {
    wrote: true,
    sources,
    reply: [
      `Brouillon enregistré pour ${client.name}, dossier ${project.name}.`,
      ...lines,
      `Total HT ${formatCents(total)}.`,
      "La validation et l’envoi restent manuels.",
      `Ouvrir le devis : /projets/${project.id}/documents/${created}`,
    ].join("\n"),
  };
}

async function rankClientDocs(docs: KnowledgeDoc[], query: string) {
  if (docs.length === 0) return [];
  const vector = await clientQueryVector(query);
  return rankKnowledge(`${query}\nremises conditions facturation`, docs, vector, 5);
}

async function clientAgreementDocs(clientId: string): Promise<KnowledgeDoc[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      projects: {
        include: { quotes: { include: { lines: true } }, events: true },
      },
    },
  });
  if (!client) return [];
  const docs: KnowledgeDoc[] = [];
  if (client.notes.trim()) {
    docs.push({ sourceType: "client", sourceId: client.id, title: client.name, summary: "", body: client.notes });
  }
  const fileIds: string[] = [];
  for (const project of client.projects) {
    const body = [project.purpose, project.deliveryNote, ...project.events.map((event) => event.body)]
      .filter(Boolean)
      .join("\n");
    if (body.trim()) {
      docs.push({ sourceType: "project", sourceId: project.id, title: project.name, summary: "", body });
    }
    for (const event of project.events) {
      if (event.fileId) fileIds.push(event.fileId);
    }
    for (const quote of project.quotes) {
      if (quote.fileId) fileIds.push(quote.fileId);
      const body = [quote.conditions, ...quote.lines.map((line) => line.conditions)].filter((part) => part.trim()).join("\n");
      if (!body.trim()) continue;
      docs.push({ sourceType: "quote", sourceId: quote.id, title: quote.title, summary: "", body });
    }
  }
  if (fileIds.length > 0) {
    const files = await prisma.storedFile.findMany({ where: { id: { in: fileIds } } });
    for (const file of files) {
      const text = documentBody(file.extractedText).trim();
      if (!text) continue;
      docs.push({
        sourceType: "piece",
        sourceId: file.id,
        title: file.originalName,
        summary: "",
        body: text.slice(0, 4000),
      });
    }
  }
  return docs;
}

async function clientQueryVector(query: string): Promise<number[] | null> {
  try {
    return await withGpuLane(async () => {
      const status = await getOllamaStatus();
      if (!status.embedModel) return null;
      const [vector] = await embedWithOllama(status.embedModel, [query]);
      return vector ?? null;
    });
  } catch {
    return null;
  }
}
