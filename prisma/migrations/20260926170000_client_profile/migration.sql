-- AlterTable
ALTER TABLE "Client" ADD COLUMN "kind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "civility" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "tradeName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "legalForm" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "postalCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "siret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "vatNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "contactName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "contactRole" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ClientProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientProposal_status_idx" ON "ClientProposal"("status");
