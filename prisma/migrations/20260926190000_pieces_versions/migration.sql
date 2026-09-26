-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "issuedOn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Quote" ADD COLUMN "supplierName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Quote" ADD COLUMN "versionLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Quote" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "Quote" ADD COLUMN "fileId" TEXT;

-- AlterTable
ALTER TABLE "QuoteLine" ADD COLUMN "statedPrice" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuoteLine" ADD COLUMN "conditions" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'autre',
    "enrichment" TEXT NOT NULL DEFAULT '',
    "contentHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_fingerprint_key" ON "Quote"("fingerprint");

-- CreateIndex
CREATE INDEX "Quote_fileId_idx" ON "Quote"("fileId");

-- CreateIndex
CREATE INDEX "StoredFile_inboxItemId_idx" ON "StoredFile"("inboxItemId");

-- CreateIndex
CREATE INDEX "StoredFile_contentHash_idx" ON "StoredFile"("contentHash");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
