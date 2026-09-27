import { centsFromWritten } from "@/domain/pricing";
import { offerChanges } from "@/domain/supplier-offer";
import { prisma } from "@/lib/db";

type OfferDb = Pick<typeof prisma, "supplierOffer" | "product">;

export type OfferInput = {
  productId: string;
  supplierId?: string | null;
  supplierName?: string;
  supplierReference?: string;
  statedCost?: string;
  currency?: string;
  sourceFileId?: string | null;
  sourceUrl?: string;
};

/** Ajoute une offre si le fournisseur ou le prix écrit diffère de la dernière offre de ce fournisseur. */
export async function recordSupplierOffer(db: OfferDb, input: OfferInput): Promise<boolean> {
  const statedCost = (input.statedCost ?? "").trim().slice(0, 80);
  const supplierName = (input.supplierName ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  const supplierId = input.supplierId ?? null;
  const latest = await db.supplierOffer.findFirst({
    where: {
      productId: input.productId,
      ...(supplierId ? { supplierId } : { supplierName }),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!offerChanges(latest ? { statedCost: latest.statedCost, supplierName: latest.supplierName } : null, { statedCost, supplierName })) {
    return false;
  }
  const currency = (input.currency ?? "").trim().slice(0, 8);
  await db.supplierOffer.create({
    data: {
      productId: input.productId,
      supplierId,
      supplierName,
      supplierReference: (input.supplierReference ?? "").trim().slice(0, 60),
      statedCost,
      unitCostCents: statedCost ? centsFromWritten(statedCost) : null,
      currency,
      sourceFileId: input.sourceFileId ?? null,
      sourceUrl: (input.sourceUrl ?? "").trim().slice(0, 500),
    },
  });
  await db.product.update({
    where: { id: input.productId },
    data: {
      ...(statedCost ? { costStated: statedCost } : {}),
      ...(currency ? { currency } : {}),
      ...(supplierId ? { supplierId } : {}),
    },
  });
  return true;
}

export async function fillMissingOfferCents(): Promise<void> {
  const pending = await prisma.supplierOffer.findMany({
    where: { unitCostCents: null, statedCost: { not: "" } },
    select: { id: true, statedCost: true },
    take: 200,
  });
  for (const offer of pending) {
    const cents = centsFromWritten(offer.statedCost);
    if (cents === null) continue;
    await prisma.supplierOffer.update({ where: { id: offer.id }, data: { unitCostCents: cents } });
  }
}
