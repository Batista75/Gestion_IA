ALTER TABLE "SaleDocument" ADD COLUMN "parentId" TEXT;

CREATE INDEX "SaleDocument_parentId_idx" ON "SaleDocument"("parentId");

ALTER TABLE "SaleDocument" ADD CONSTRAINT "SaleDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SaleDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "SaleDocument" AS child
SET "parentId" = parent."id"
FROM "SaleDocument" AS parent
WHERE child."sourceId" = parent."id"
  AND child."sourceId" <> ''
  AND child."parentId" IS NULL;
