CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_nameKey_key" ON "Organization"("nameKey");

ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "Client_organizationId_key" ON "Client"("organizationId");
CREATE UNIQUE INDEX "Supplier_organizationId_key" ON "Supplier"("organizationId");

INSERT INTO "Organization" ("id", "name", "nameKey", "createdAt")
SELECT gen_random_uuid()::text, c."name", c."nameKey", c."createdAt"
FROM "Client" c;

UPDATE "Client" AS c
SET "organizationId" = o."id"
FROM "Organization" AS o
WHERE o."nameKey" = c."nameKey";

INSERT INTO "Organization" ("id", "name", "nameKey", "createdAt")
SELECT gen_random_uuid()::text, s."name", s."nameKey", s."createdAt"
FROM "Supplier" s
WHERE NOT EXISTS (
    SELECT 1 FROM "Organization" AS o WHERE o."nameKey" = s."nameKey"
);

UPDATE "Supplier" AS s
SET "organizationId" = o."id"
FROM "Organization" AS o
WHERE o."nameKey" = s."nameKey";

ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
