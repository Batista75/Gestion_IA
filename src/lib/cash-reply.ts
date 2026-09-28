import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import { cashGapPacket, cashWeekPacket, readCashQuestion, weekWindow } from "@/domain/cash";
import { prisma } from "@/lib/db";

export type CashReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier";
};

export async function resolveCash(text: string, now = new Date()): Promise<CashReply | null> {
  const question = readCashQuestion(text);
  if (!question) return null;
  if (question.period === "missing") {
    const packet = cashGapPacket("Indiquez la période : cette semaine.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.period === "unsupported") {
    const packet = cashGapPacket("Ce relevé se demande sur cette semaine.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const [purchases, undatedReceipts] = await Promise.all([
    prisma.purchaseFollowUp.findMany({
      select: {
        designation: true,
        invoiceOn: true,
        invoiceCents: true,
        supplier: { select: { name: true, paymentDays: true } },
      },
    }),
    prisma.saleDocument.count({ where: { kind: "commande_client", confirmedAt: { not: null } } }),
  ]);
  const packet = cashWeekPacket({
    suppliers: purchases.map((row) => ({
      supplierName: row.supplier.name,
      designation: row.designation,
      invoiceOn: row.invoiceOn,
      invoiceCents: row.invoiceCents,
      paymentDays: row.supplier.paymentDays,
    })),
    receipts: [],
    ...weekWindow(now),
    undatedReceipts,
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}
