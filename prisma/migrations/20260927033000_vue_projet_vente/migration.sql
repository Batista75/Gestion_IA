CREATE TABLE "ProjectLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'produit',
    "name" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costCents" INTEGER,
    "markupPercent" INTEGER NOT NULL DEFAULT 30,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_cours',
    "title" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleDocumentLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'produit',
    "name" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costCents" INTEGER,
    "markupPercent" INTEGER NOT NULL DEFAULT 30,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleDocumentLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectLine_projectId_idx" ON "ProjectLine"("projectId");
CREATE INDEX "SaleDocument_projectId_idx" ON "SaleDocument"("projectId");
CREATE INDEX "SaleDocumentLine_documentId_idx" ON "SaleDocumentLine"("documentId");

ALTER TABLE "ProjectLine" ADD CONSTRAINT "ProjectLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectLine" ADD CONSTRAINT "ProjectLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleDocument" ADD CONSTRAINT "SaleDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleDocumentLine" ADD CONSTRAINT "SaleDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SaleDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
