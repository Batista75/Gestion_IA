CREATE TABLE "ContractProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractProposal_status_idx" ON "ContractProposal"("status");
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");
CREATE INDEX "Contract_endsOn_idx" ON "Contract"("endsOn");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
