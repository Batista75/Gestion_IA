ALTER TABLE "Supplier" ADD COLUMN "outstandingCents" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "paymentDays" INTEGER;

CREATE TABLE "PurchaseFollowUpProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseFollowUpProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierTermsProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierTermsProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseFollowUp" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "orderedOn" TEXT NOT NULL,
    "orderCents" INTEGER NOT NULL,
    "invoiceCents" INTEGER,
    "remainder" TEXT NOT NULL,
    "shipsOn" TEXT NOT NULL DEFAULT '',
    "tracking" TEXT NOT NULL DEFAULT '',
    "delivery" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseFollowUpProposal_status_idx" ON "PurchaseFollowUpProposal"("status");
CREATE INDEX "SupplierTermsProposal_status_idx" ON "SupplierTermsProposal"("status");
CREATE INDEX "PurchaseFollowUp_supplierId_idx" ON "PurchaseFollowUp"("supplierId");
CREATE INDEX "PurchaseFollowUp_orderedOn_idx" ON "PurchaseFollowUp"("orderedOn");

ALTER TABLE "PurchaseFollowUp" ADD CONSTRAINT "PurchaseFollowUp_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
