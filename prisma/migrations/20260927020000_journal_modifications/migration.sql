CREATE TABLE "RecordEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecordEvent_entityType_entityId_idx" ON "RecordEvent"("entityType", "entityId");
CREATE INDEX "RecordEvent_createdAt_idx" ON "RecordEvent"("createdAt");
