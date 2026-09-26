ALTER TABLE "Project" ADD COLUMN "clientId" TEXT;

UPDATE "Project" AS p
SET "clientId" = c.id
FROM "Client" AS c
WHERE p."clientId" IS NULL
  AND lower(c.name) = lower(p."primaryClient");

CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
