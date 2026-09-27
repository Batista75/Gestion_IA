ALTER TABLE "ConversationMessage" ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ConversationMessage" ADD COLUMN "confidence" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ConversationMessage" ADD COLUMN "validatedAt" TIMESTAMP(3);

ALTER TABLE "CatalogProposal" ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CatalogProposal" ADD COLUMN "confidence" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CatalogProposal" ADD COLUMN "validatedAt" TIMESTAMP(3);

ALTER TABLE "ClientProposal" ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClientProposal" ADD COLUMN "confidence" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ClientProposal" ADD COLUMN "validatedAt" TIMESTAMP(3);

ALTER TABLE "DocumentProposal" ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentProposal" ADD COLUMN "confidence" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentProposal" ADD COLUMN "validatedAt" TIMESTAMP(3);
