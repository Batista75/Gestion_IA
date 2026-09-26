ALTER TABLE "Project" ADD COLUMN "tradeKey" TEXT NOT NULL DEFAULT 'achat-revente-technologies';

CREATE TABLE "ProjectStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'a_faire',
    "proofRef" TEXT NOT NULL DEFAULT '',
    "proofNote" TEXT NOT NULL DEFAULT '',
    "recordedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectStep_projectId_stepKey_key" ON "ProjectStep"("projectId", "stepKey");
CREATE INDEX "ProjectStep_projectId_idx" ON "ProjectStep"("projectId");

ALTER TABLE "ProjectStep" ADD CONSTRAINT "ProjectStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
