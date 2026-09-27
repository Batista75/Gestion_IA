CREATE TABLE "SupplierOffer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "supplierReference" TEXT NOT NULL DEFAULT '',
    "statedCost" TEXT NOT NULL DEFAULT '',
    "unitCostCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT '',
    "sourceFileId" TEXT,
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierOffer_productId_createdAt_idx" ON "SupplierOffer"("productId", "createdAt");
CREATE INDEX "SupplierOffer_supplierId_idx" ON "SupplierOffer"("supplierId");
CREATE INDEX "SupplierOffer_sourceFileId_idx" ON "SupplierOffer"("sourceFileId");

ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SupplierOffer" (
    "id",
    "productId",
    "supplierId",
    "supplierName",
    "supplierReference",
    "statedCost",
    "currency",
    "sourceUrl",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    p."id",
    p."supplierId",
    COALESCE(s."name", ''),
    p."reference",
    p."costStated",
    p."currency",
    p."sourceUrl",
    p."createdAt"
FROM "Product" p
LEFT JOIN "Supplier" s ON s."id" = p."supplierId"
WHERE p."costStated" <> '' OR p."supplierId" IS NOT NULL;
