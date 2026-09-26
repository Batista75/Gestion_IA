-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_sourceType_sourceId_key" ON "KnowledgeChunk"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_sourceType_idx" ON "KnowledgeChunk"("sourceType");
