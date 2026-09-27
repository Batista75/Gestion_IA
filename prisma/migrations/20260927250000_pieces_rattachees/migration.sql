CREATE TABLE "NotedPiece" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "saleParentId" TEXT,
    "pieceParentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotedPiece_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotedPiece_projectId_idx" ON "NotedPiece"("projectId");
CREATE INDEX "NotedPiece_saleParentId_idx" ON "NotedPiece"("saleParentId");
CREATE INDEX "NotedPiece_pieceParentId_idx" ON "NotedPiece"("pieceParentId");

ALTER TABLE "NotedPiece" ADD CONSTRAINT "NotedPiece_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotedPiece" ADD CONSTRAINT "NotedPiece_saleParentId_fkey" FOREIGN KEY ("saleParentId") REFERENCES "SaleDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotedPiece" ADD CONSTRAINT "NotedPiece_pieceParentId_fkey" FOREIGN KEY ("pieceParentId") REFERENCES "NotedPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;
