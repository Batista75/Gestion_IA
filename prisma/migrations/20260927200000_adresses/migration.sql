CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "supplierId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'siege',
    "line" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Address_clientId_idx" ON "Address"("clientId");
CREATE INDEX "Address_supplierId_idx" ON "Address"("supplierId");

ALTER TABLE "Address" ADD CONSTRAINT "Address_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Address" ("id", "clientId", "kind", "line", "postalCode", "city", "country", "isPrimary", "createdAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    'siege',
    c."address",
    c."postalCode",
    c."city",
    c."country",
    true,
    c."createdAt"
FROM "Client" c
WHERE btrim(c."address") <> '' OR btrim(c."postalCode") <> '' OR btrim(c."city") <> '' OR btrim(c."country") <> '';

INSERT INTO "Address" ("id", "supplierId", "kind", "line", "postalCode", "city", "country", "isPrimary", "createdAt")
SELECT
    gen_random_uuid()::text,
    s."id",
    'siege',
    s."address",
    s."postalCode",
    s."city",
    s."country",
    true,
    s."createdAt"
FROM "Supplier" s
WHERE btrim(s."address") <> '' OR btrim(s."postalCode") <> '' OR btrim(s."city") <> '' OR btrim(s."country") <> '';
