ALTER TABLE "CatalogProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "ClientProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "ContractProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "InterventionProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "InstalledEquipmentProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "PurchaseFollowUpProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "SupplierTermsProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "ClaimProposal" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "ReturnRequestProposal" ADD COLUMN "conversationId" TEXT;

UPDATE "CatalogProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "ClientProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "ContractProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "InterventionProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "InstalledEquipmentProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "PurchaseFollowUpProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "SupplierTermsProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "ClaimProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';
UPDATE "ReturnRequestProposal" SET "status" = 'expiree' WHERE "conversationId" IS NULL AND "status" = 'en_attente';

CREATE TABLE "BusinessPlanProposal" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "failureNote" TEXT NOT NULL DEFAULT '',
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPlanProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogProposal_conversationId_status_idx" ON "CatalogProposal"("conversationId", "status");
CREATE INDEX "ClientProposal_conversationId_status_idx" ON "ClientProposal"("conversationId", "status");
CREATE INDEX "ContractProposal_conversationId_status_idx" ON "ContractProposal"("conversationId", "status");
CREATE INDEX "InterventionProposal_conversationId_status_idx" ON "InterventionProposal"("conversationId", "status");
CREATE INDEX "InstalledEquipmentProposal_conversationId_status_idx" ON "InstalledEquipmentProposal"("conversationId", "status");
CREATE INDEX "PurchaseFollowUpProposal_conversationId_status_idx" ON "PurchaseFollowUpProposal"("conversationId", "status");
CREATE INDEX "SupplierTermsProposal_conversationId_status_idx" ON "SupplierTermsProposal"("conversationId", "status");
CREATE INDEX "ClaimProposal_conversationId_status_idx" ON "ClaimProposal"("conversationId", "status");
CREATE INDEX "ReturnRequestProposal_conversationId_status_idx" ON "ReturnRequestProposal"("conversationId", "status");
CREATE INDEX "BusinessPlanProposal_conversationId_status_idx" ON "BusinessPlanProposal"("conversationId", "status");

ALTER TABLE "CatalogProposal" ADD CONSTRAINT "CatalogProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractProposal" ADD CONSTRAINT "ContractProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterventionProposal" ADD CONSTRAINT "InterventionProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstalledEquipmentProposal" ADD CONSTRAINT "InstalledEquipmentProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseFollowUpProposal" ADD CONSTRAINT "PurchaseFollowUpProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierTermsProposal" ADD CONSTRAINT "SupplierTermsProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClaimProposal" ADD CONSTRAINT "ClaimProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestProposal" ADD CONSTRAINT "ReturnRequestProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessPlanProposal" ADD CONSTRAINT "BusinessPlanProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
