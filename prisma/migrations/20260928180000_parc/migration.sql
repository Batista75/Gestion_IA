CREATE TABLE "InstalledEquipmentProposal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '',
    "confidence" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstalledEquipmentProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstalledEquipment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT,
    "designation" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "installedOn" TEXT NOT NULL,
    "warranty" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstalledEquipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstalledEquipmentProposal_status_idx" ON "InstalledEquipmentProposal"("status");
CREATE INDEX "InstalledEquipment_clientId_idx" ON "InstalledEquipment"("clientId");
CREATE INDEX "InstalledEquipment_productId_idx" ON "InstalledEquipment"("productId");
CREATE INDEX "InstalledEquipment_installedOn_idx" ON "InstalledEquipment"("installedOn");

ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstalledEquipment" ADD CONSTRAINT "InstalledEquipment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
