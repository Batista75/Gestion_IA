-- CreateTable
CREATE TABLE "Demand" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "clientName" TEXT NOT NULL DEFAULT '',
    "supplierName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ouverte',
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "fileId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Demand_fileId_idx" ON "Demand"("fileId");

-- CreateIndex
CREATE INDEX "Demand_status_idx" ON "Demand"("status");

-- CreateIndex
CREATE INDEX "DocumentProposal_status_idx" ON "DocumentProposal"("status");

-- CreateIndex
CREATE INDEX "DocumentProposal_fileId_idx" ON "DocumentProposal"("fileId");

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentProposal" ADD CONSTRAINT "DocumentProposal_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
