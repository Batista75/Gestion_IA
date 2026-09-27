ALTER TABLE "Quote" ADD COLUMN "statedTotalHtCents" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "statedVatCents" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "statedTotalTtcCents" INTEGER;
ALTER TABLE "QuoteLine" ADD COLUMN "statedPriceCents" INTEGER;
