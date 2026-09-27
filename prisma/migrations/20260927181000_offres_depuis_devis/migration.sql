INSERT INTO "SupplierOffer" (
    "id",
    "productId",
    "supplierId",
    "supplierName",
    "supplierReference",
    "statedCost",
    "currency",
    "sourceFileId",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    ql."productId",
    s."id",
    COALESCE(NULLIF(q."supplierName", ''), s."name", ''),
    pr."reference",
    ql."statedPrice",
    CASE
        WHEN ql."statedPrice" LIKE '%$%' OR ql."statedPrice" ILIKE '%usd%' THEN 'USD'
        WHEN ql."statedPrice" LIKE '%€%' OR ql."statedPrice" ILIKE '%eur%' THEN 'EUR'
        ELSE COALESCE(NULLIF(q."currency", ''), pr."currency", '')
    END,
    q."fileId",
    q."createdAt"
FROM "QuoteLine" ql
JOIN "Quote" q ON q."id" = ql."quoteId"
JOIN "Product" pr ON pr."id" = ql."productId"
LEFT JOIN "Supplier" s ON lower(s."name") = lower(q."supplierName")
WHERE ql."statedPrice" <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "SupplierOffer" existing
    WHERE existing."productId" = ql."productId"
      AND existing."statedCost" = ql."statedPrice"
      AND existing."supplierName" = COALESCE(NULLIF(q."supplierName", ''), s."name", '')
  );

DELETE FROM "SupplierOffer" empty
WHERE empty."statedCost" = ''
  AND EXISTS (
    SELECT 1
    FROM "SupplierOffer" priced
    WHERE priced."productId" = empty."productId"
      AND priced."statedCost" <> ''
  );
