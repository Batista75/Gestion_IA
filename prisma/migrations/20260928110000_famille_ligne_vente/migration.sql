ALTER TABLE "Product" ADD COLUMN "family" TEXT NOT NULL DEFAULT '';

ALTER TABLE "SaleDocumentLine" ADD COLUMN "productId" TEXT;
ALTER TABLE "SaleDocumentLine" ADD COLUMN "family" TEXT NOT NULL DEFAULT '';

CREATE INDEX "SaleDocumentLine_productId_idx" ON "SaleDocumentLine"("productId");

ALTER TABLE "SaleDocumentLine" ADD CONSTRAINT "SaleDocumentLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
