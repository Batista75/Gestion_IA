ALTER TABLE "Supplier" ADD COLUMN "siret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "vatNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "legalForm" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "postalCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "supplierId" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");
CREATE INDEX "Contact_supplierId_idx" ON "Contact"("supplierId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Contact" ("id", "clientId", "firstName", "lastName", "role", "email", "phone", "isPrimary", "createdAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    CASE
        WHEN position(' ' in btrim(c."contactName")) > 0 THEN regexp_replace(btrim(c."contactName"), ' [^ ]+$', '')
        ELSE ''
    END,
    CASE
        WHEN btrim(c."contactName") = '' THEN ''
        WHEN position(' ' in btrim(c."contactName")) > 0 THEN regexp_replace(btrim(c."contactName"), '^.* ', '')
        ELSE btrim(c."contactName")
    END,
    c."contactRole",
    c."email",
    c."phone",
    true,
    c."createdAt"
FROM "Client" c
WHERE btrim(c."contactName") <> '' OR btrim(c."email") <> '' OR btrim(c."phone") <> '';

INSERT INTO "Contact" ("id", "supplierId", "firstName", "lastName", "role", "email", "phone", "isPrimary", "createdAt")
SELECT
    gen_random_uuid()::text,
    s."id",
    '',
    '',
    '',
    s."email",
    s."phone",
    true,
    s."createdAt"
FROM "Supplier" s
WHERE btrim(s."email") <> '' OR btrim(s."phone") <> '';
