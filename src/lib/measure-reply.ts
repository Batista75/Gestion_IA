import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  averageLineMargin,
  bestTariffPacket,
  lastCustomerOrder,
  marginPeriodPacket,
  previousMonthWindow,
  raisedWholesalePrices,
  readMeasureQuestion,
  receptionReportPacket,
  type PendingCost,
} from "@/domain/measures";
import { storedSaleFigures } from "@/domain/pricing";
import { compareOffers } from "@/domain/supplier-offer";
import { prisma } from "@/lib/db";

export async function resolveMeasure(
  text: string,
  now = new Date(),
): Promise<{ reply: string; packet: AnswerPacket } | null> {
  const question = readMeasureQuestion(text);
  if (!question) return null;
  const packet = await packetFor(question, now);
  return { packet, reply: safeReply(packet) };
}

async function packetFor(
  question: NonNullable<ReturnType<typeof readMeasureQuestion>>,
  now: Date,
): Promise<AnswerPacket> {
  if (question.kind === "average_margin") {
    if (question.period !== "previous_month") return marginPeriodPacket(question.period);
    const window = previousMonthWindow(now);
    const lines = await prisma.saleDocumentLine.findMany({
      where: { document: { kind: "commande_client", confirmedAt: { gte: window.from, lt: window.to } } },
      include: { document: { select: { confirmedAt: true } } },
    });
    return averageLineMargin({
      lines: lines.map((line) => ({
        family: line.family,
        confirmedAt: line.document.confirmedAt,
        marginCents: lineMargin(line),
      })),
      families: question.families,
      from: window.from,
      to: window.to,
      periodLabel: window.label,
    });
  }
  if (question.kind === "raised_prices") return raisedWholesalePrices(await pendingCosts());
  if (question.kind === "last_order") return lastCustomerOrder(await customerOrders(), question.client);
  if (question.kind === "best_tariff") {
    const reference = question.reference.trim();
    if (!reference) return bestTariffPacket("", [], "");
    const products = await prisma.product.findMany({
      where: { reference: { equals: reference, mode: "insensitive" } },
      include: { offers: true },
    });
    const compared = compareOffers(
      products.flatMap((product) =>
        product.offers.map((offer) => ({
          id: offer.id,
          supplierName: offer.supplierName,
          statedCost: offer.statedCost,
          unitCostCents: offer.unitCostCents,
        })),
      ),
    );
    return bestTariffPacket(reference, compared.rows, compared.note);
  }
  return receptionReportPacket(question.client, await receptionHits(question.client));
}

function lineMargin(line: {
  quantity: number;
  costCents: number | null;
  markupPercent: number;
  discountPercent: number;
  saleUnitCents: number | null;
}): number | null {
  try {
    return storedSaleFigures(line).lineMarginCents;
  } catch {
    return null;
  }
}

async function pendingCosts(): Promise<PendingCost[]> {
  const documents = await prisma.saleDocument.findMany({
    where: { kind: "devis", status: "en_cours" },
    include: {
      lines: { include: { product: { select: { reference: true } } } },
      project: { select: { primaryClient: true, client: { select: { name: true } } } },
    },
  });
  const productIds = [
    ...new Set(documents.flatMap((document) => document.lines.map((line) => line.productId).filter((id): id is string => Boolean(id)))),
  ];
  const offers = productIds.length
    ? await prisma.supplierOffer.findMany({ where: { productId: { in: productIds } } })
    : [];
  return documents.flatMap((document) =>
    document.lines.map((line) => ({
      documentTitle: document.title,
      clientName: document.project.client?.name || document.project.primaryClient,
      productName: line.name,
      reference: line.product?.reference ?? "",
      costCents: line.costCents,
      issuedAt: document.createdAt,
      offers: offers
        .filter((offer) => offer.productId === line.productId)
        .map((offer) => ({
          cents: offer.unitCostCents,
          at: offer.createdAt,
          supplierName: offer.supplierName,
          statedCost: offer.statedCost,
        })),
    })),
  );
}

async function customerOrders() {
  const documents = await prisma.saleDocument.findMany({
    where: { kind: "commande_client" },
    include: {
      lines: true,
      project: { select: { primaryClient: true, client: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return documents.map((document) => ({
    title: document.title,
    clientName: document.project.client?.name || document.project.primaryClient,
    at: document.confirmedAt ?? document.createdAt,
    lines: document.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      supplierName: line.supplierName,
      family: line.family,
    })),
  }));
}

async function receptionHits(client: string): Promise<Array<{ title: string; excerpt: string }>> {
  const name = client.trim().toLowerCase();
  if (!name) return [];
  const files = await prisma.storedFile.findMany({
    where: {
      OR: [
        { extractedText: { contains: "procès-verbal", mode: "insensitive" } },
        { extractedText: { contains: "procès verbal", mode: "insensitive" } },
        { originalName: { contains: "proces", mode: "insensitive" } },
        { enrichment: { contains: "procès-verbal", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      OR: [
        { body: { contains: "procès-verbal", mode: "insensitive" } },
        { body: { contains: "procès verbal", mode: "insensitive" } },
      ],
    },
    take: 20,
  });
  const hits = [
    ...files.map((file) => ({
      title: file.originalName,
      excerpt: excerpt(file.extractedText || file.enrichment),
      haystack: `${file.originalName}\n${file.extractedText}\n${file.enrichment}`.toLowerCase(),
    })),
    ...chunks.map((chunk) => ({
      title: chunk.title,
      excerpt: excerpt(chunk.body),
      haystack: `${chunk.title}\n${chunk.body}`.toLowerCase(),
    })),
  ];
  return hits.filter((hit) => hit.haystack.includes(name)).map(({ title, excerpt: text }) => ({ title, excerpt: text }));
}

function excerpt(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
}
