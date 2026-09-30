ALTER TABLE "InboxItem" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'depot';
ALTER TABLE "InboxItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'a_traiter';
ALTER TABLE "InboxItem" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "InboxItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "InboxItem" SET "updatedAt" = "createdAt";

ALTER TABLE "BusinessPlanProposal" ADD COLUMN "inboxItemId" TEXT;
ALTER TABLE "DocumentProposal" ADD COLUMN "inboxItemId" TEXT;

UPDATE "DocumentProposal" AS dp
SET "inboxItemId" = sf."inboxItemId"
FROM "StoredFile" AS sf
WHERE dp."fileId" = sf."id";

UPDATE "InboxItem" AS item
SET "status" = 'proposee'
WHERE EXISTS (
  SELECT 1 FROM "DocumentProposal" AS dp
  WHERE dp."inboxItemId" = item."id" AND dp."status" = 'en_attente'
);

UPDATE "InboxItem" AS item
SET "status" = 'traitee'
WHERE item."status" = 'a_traiter'
  AND EXISTS (
    SELECT 1 FROM "DocumentProposal" AS dp
    WHERE dp."inboxItemId" = item."id" AND dp."status" = 'confirmee'
  );

CREATE INDEX "InboxItem_status_idx" ON "InboxItem"("status");
CREATE INDEX "InboxItem_conversationId_idx" ON "InboxItem"("conversationId");
CREATE INDEX "BusinessPlanProposal_inboxItemId_idx" ON "BusinessPlanProposal"("inboxItemId");
CREATE INDEX "DocumentProposal_inboxItemId_idx" ON "DocumentProposal"("inboxItemId");

ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessPlanProposal" ADD CONSTRAINT "BusinessPlanProposal_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentProposal" ADD CONSTRAINT "DocumentProposal_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
