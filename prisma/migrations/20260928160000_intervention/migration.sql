CREATE TABLE "InterventionProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "rateUnit" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "ticket" TEXT NOT NULL DEFAULT '',
    "billedReference" TEXT NOT NULL DEFAULT '',
    "onSite" BOOLEAN NOT NULL DEFAULT false,
    "underContract" BOOLEAN NOT NULL DEFAULT false,
    "requestedOn" TEXT NOT NULL DEFAULT '',
    "arrivedOn" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterventionProposal_status_idx" ON "InterventionProposal"("status");
CREATE INDEX "Intervention_clientId_idx" ON "Intervention"("clientId");
CREATE INDEX "Intervention_projectId_idx" ON "Intervention"("projectId");
CREATE INDEX "Intervention_occurredOn_idx" ON "Intervention"("occurredOn");

ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
