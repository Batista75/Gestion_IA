import { centsFromWritten } from "@/domain/pricing";
import { prisma } from "@/lib/db";

/** Recopie en centimes le premier montant déjà écrit. N’additionne pas les lignes. */
export async function fillMissingQuoteCents(): Promise<void> {
  if (typeof prisma.quote?.update !== "function" || typeof prisma.quoteLine?.update !== "function") return;
  const quotes = await prisma.quote.findMany({
    where: {
      OR: [
        { statedTotalHt: { not: "" }, statedTotalHtCents: null },
        { statedVat: { not: "" }, statedVatCents: null },
        { statedTotalTtc: { not: "" }, statedTotalTtcCents: null },
      ],
    },
    select: {
      id: true,
      statedTotalHt: true,
      statedVat: true,
      statedTotalTtc: true,
      statedTotalHtCents: true,
      statedVatCents: true,
      statedTotalTtcCents: true,
    },
    take: 200,
  });
  for (const quote of quotes) {
    const statedTotalHtCents = quote.statedTotalHtCents ?? centsFromWritten(quote.statedTotalHt);
    const statedVatCents = quote.statedVatCents ?? centsFromWritten(quote.statedVat);
    const statedTotalTtcCents = quote.statedTotalTtcCents ?? centsFromWritten(quote.statedTotalTtc);
    if (statedTotalHtCents === null && statedVatCents === null && statedTotalTtcCents === null) continue;
    await prisma.quote.update({
      where: { id: quote.id },
      data: { statedTotalHtCents, statedVatCents, statedTotalTtcCents },
    });
  }
  const lines = await prisma.quoteLine.findMany({
    where: { statedPrice: { not: "" }, statedPriceCents: null },
    select: { id: true, statedPrice: true },
    take: 400,
  });
  for (const line of lines) {
    const statedPriceCents = centsFromWritten(line.statedPrice);
    if (statedPriceCents === null) continue;
    await prisma.quoteLine.update({ where: { id: line.id }, data: { statedPriceCents } });
  }
}
