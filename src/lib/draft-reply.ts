import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  draftGapPacket,
  invoiceDraftPacket,
  quoteDraftPacket,
  readDraftQuestion,
  trackingDraftPacket,
} from "@/domain/drafts";
import { uniqueNameMatch } from "@/domain/knowledge";
import { centsFromStated } from "@/domain/pricing";
import { prisma } from "@/lib/db";

export type DraftReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier";
};

export async function resolveDraft(text: string, now = new Date()): Promise<DraftReply | null> {
  const question = readDraftQuestion(text);
  if (!question) return null;
  if (question.kind === "invoice") return answerInvoice(question, now);
  if (question.kind === "tracking") return answerTracking(text);
  return answerQuote(text);
}

async function answerInvoice(
  question: { days: number | null; daysConflict: boolean },
  now: Date,
): Promise<DraftReply> {
  if (question.daysConflict) {
    const packet = draftGapPacket("Relance de facture", "Un seul retard en jours.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.days === null) {
    const packet = draftGapPacket("Relance de facture", "Indiquez le retard en jours, par exemple 15 jours.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const rows = await prisma.purchaseFollowUp.findMany({
    select: {
      designation: true,
      invoiceReference: true,
      invoiceOn: true,
      invoiceCents: true,
      supplier: { select: { name: true } },
    },
  });
  const packet = invoiceDraftPacket({
    rows: rows.map((row) => ({
      supplierName: row.supplier.name,
      designation: row.designation,
      invoiceReference: row.invoiceReference,
      invoiceOn: row.invoiceOn,
      invoiceCents: row.invoiceCents,
    })),
    days: question.days,
    today: now.toISOString().slice(0, 10),
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function answerTracking(text: string): Promise<DraftReply> {
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const name = uniqueNameMatch(text, suppliers.map((supplier) => supplier.name));
  const matches = suppliers.filter((supplier) => supplier.name === name);
  if (!name || matches.length !== 1) {
    const packet = draftGapPacket("Relance de suivi", "Indiquez un seul grossiste déjà enregistré.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const supplier = matches[0];
  if (!supplier) {
    const packet = draftGapPacket("Relance de suivi", "Indiquez un seul grossiste déjà enregistré.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const rows = await prisma.purchaseFollowUp.findMany({
    where: { supplierId: supplier.id },
    select: { designation: true, orderedOn: true, tracking: true },
  });
  const packet = trackingDraftPacket({
    supplierName: supplier.name,
    rows: rows.map((row) => ({ ...row, supplierName: supplier.name })),
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function answerQuote(text: string): Promise<DraftReply> {
  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({ select: { name: true, reference: true, costStated: true } }),
    prisma.supplier.findMany({ select: { name: true } }),
  ]);
  const productName = uniqueNameMatch(text, products.map((product) => product.name));
  const productHits = products.filter((product) => product.name === productName);
  if (!productName || productHits.length !== 1) {
    const packet = draftGapPacket("Demande de cotation", "Indiquez un seul article déjà au catalogue.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const supplierName = uniqueNameMatch(text, suppliers.map((supplier) => supplier.name));
  const supplierHits = suppliers.filter((supplier) => supplier.name === supplierName);
  if (!supplierName || supplierHits.length !== 1) {
    const packet = draftGapPacket("Demande de cotation", "Indiquez un seul constructeur ou grossiste déjà au répertoire.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const product = productHits[0];
  const supplier = supplierHits[0];
  if (!product || !supplier) {
    const packet = draftGapPacket("Demande de cotation", "Indiquez un seul article déjà au catalogue.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const packet = quoteDraftPacket({
    supplierName: supplier.name,
    productName: product.name,
    reference: product.reference.trim(),
    costCents: centsFromStated(product.costStated),
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}
