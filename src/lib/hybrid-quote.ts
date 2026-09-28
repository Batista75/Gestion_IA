import { documentBody } from "@/domain/document-chunks";
import { composeQuote, discountConflict, negotiatedDiscount, quotePacket } from "@/domain/hybrid-quote";
import type { AnswerPacket } from "@/domain/answer-packet";
import { safeReply } from "@/domain/answer-packet";
import { foldText, rankKnowledge, uniqueNameMatch, type KnowledgeDoc } from "@/domain/knowledge";
import { centsFromStated } from "@/domain/pricing";
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
  packet: AnswerPacket;
}> {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, notes: true } });
  const clientName = uniqueNameMatch(text, clients.map((client) => client.name));
  if (!clientName) {
    const missing = clients.length === 0
      ? "Aucun client n’est au répertoire. Le devis n’est pas préparé."
      : "Nommez un seul client déjà enregistré. Aucune recherche de conditions n’est lancée sans lui.";
    const packet = quotePacket({ clientName: "", projectName: "", lines: [], missing: [missing], href: "" });
    return { wrote: false, sources: [], reply: safeReply(packet), packet };
  }
  const client = clients.find((item) => item.name === clientName);
  if (!client) {
    const packet = quotePacket({
      clientName,
      projectName: "",
      lines: [],
      missing: ["Ce client est introuvable."],
      href: "",
    });
    return { wrote: false, sources: [], reply: safeReply(packet), packet };
  }
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      reference: true,
      statedPrice: true,
      costStated: true,
      currency: true,
      kind: true,
      family: true,
      stockQty: true,
      supplier: { select: { name: true } },
    },
  });
  const agreements = await clientAgreementDocs(client.id);
  const clauseText = agreements.map((doc) => doc.body).join("\n");
  const conflict = discountConflict(clauseText);
  const discount = conflict ? null : negotiatedDiscount(clauseText);
  const ranked = await rankClientDocs(agreements, text);
  const cited = ranked.length > 0 ? ranked : agreements.filter((doc) => /remise/i.test(doc.body));
  const sources = cited.slice(0, 5).map((doc) => ({ label: "Conditions", title: doc.title }));
  const composed = composeQuote({
    text,
    clientName: client.name,
    discountPercent: discount,
    discountConflict: conflict,
    catalog: products.map((product) => ({
      name: product.name,
      reference: product.reference,
      kind: product.kind === "service" ? "service" : "produit",
      family: product.family,
      currency: product.currency === "USD" ? "USD" : product.currency === "EUR" ? "EUR" : "",
      statedPriceCents: centsFromStated(product.statedPrice),
      costCents: centsFromStated(product.costStated),
      stockQty: product.stockQty,
    })),
  });
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
  const missing = [...composed.missing];
  const ready = composed.lines.length > 0 && composed.missing.length === 0;
  if (!ready) {
    if (composed.lines.length > 0) missing.push("Le brouillon n’est pas enregistré.");
  } else if (!project) {
    missing.push(
      projects.length === 0
        ? "Aucun dossier n’est ouvert pour ce client. Le brouillon n’est pas enregistré."
        : `Plusieurs dossiers existent : ${projects.map((item) => item.name).join(", ")}. Nommez-en un. Le brouillon n’est pas enregistré.`,
    );
  }
  if (!project || !ready) {
    const packet = quotePacket({
      clientName: client.name,
      projectName: project?.name ?? "",
      lines: composed.lines,
      missing,
      href: "",
    });
    return { wrote: false, sources, reply: safeReply(packet), packet };
  }
  const created = await withChangeSource("assistant", async () => {
    const document = await prisma.saleDocument.create({
      data: {
        projectId: project.id,
        kind: "devis",
        status: "brouillon",
        title: `Devis ${client.name}`,
        lines: {
          create: composed.lines.map((line) => {
            const product = products.find((candidate) => foldText(candidate.name) === foldText(line.name));
            return {
              name: line.name,
              kind: line.kind,
              quantity: line.quantity,
              costCents: line.costCents,
              saleUnitCents: line.saleUnitCents,
              markupPercent: line.markupPercent,
              discountPercent: line.discountPercent,
              productId: product?.id,
              family: product?.family ?? line.family,
              supplierName: product?.supplier?.name ?? "",
            };
          }),
        },
      },
    });
    await prisma.projectEvent.create({
      data: {
        projectId: project.id,
        kind: "devis",
        body: `Brouillon de devis pour ${client.name}.`,
      },
    });
    return document.id;
  });
  const href = `/projets/${project.id}/documents/${created}`;
  const packet = quotePacket({
    clientName: client.name,
    projectName: project.name,
    lines: composed.lines,
    missing: ["La validation et l’envoi restent manuels."],
    href,
  });
  return { wrote: true, sources, reply: safeReply(packet), packet };
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
