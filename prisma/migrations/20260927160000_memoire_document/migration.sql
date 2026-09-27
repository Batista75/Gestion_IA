CREATE TABLE "DocumentMemory" (
    "id" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "projet" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "societe" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentMemory_documentKey_key" ON "DocumentMemory"("documentKey");
