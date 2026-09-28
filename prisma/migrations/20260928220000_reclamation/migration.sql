CREATE TABLE "ClaimProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnRequestProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRequestProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "underWarranty" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClaimProposal_status_idx" ON "ClaimProposal"("status");
CREATE INDEX "Claim_clientId_idx" ON "Claim"("clientId");
CREATE INDEX "Claim_occurredOn_idx" ON "Claim"("occurredOn");
CREATE INDEX "ReturnRequestProposal_status_idx" ON "ReturnRequestProposal"("status");
CREATE INDEX "ReturnRequest_clientId_idx" ON "ReturnRequest"("clientId");
CREATE INDEX "ReturnRequest_occurredOn_idx" ON "ReturnRequest"("occurredOn");

ALTER TABLE "Claim" ADD CONSTRAINT "Claim_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
