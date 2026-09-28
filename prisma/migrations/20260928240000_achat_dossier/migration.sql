ALTER TABLE "PurchaseFollowUp" ADD COLUMN "projectId" TEXT;

CREATE INDEX "PurchaseFollowUp_projectId_idx" ON "PurchaseFollowUp"("projectId");

ALTER TABLE "PurchaseFollowUp" ADD CONSTRAINT "PurchaseFollowUp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
