-- Storefront cutover PR1: fields OnecStockItem/OnecCategory don't get from 1C sync,
-- backfilled once from StockItem (packQty/sizeInches/onSale/salePercent) or generated
-- (slug). None of these are added to onecImport.ts's ON CONFLICT DO UPDATE SET, so a
-- future 1C sync never overwrites them.

ALTER TABLE "OnecStockItem" ADD COLUMN "slug" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "packQty" INTEGER;
ALTER TABLE "OnecStockItem" ADD COLUMN "sizeInches" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "onSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnecStockItem" ADD COLUMN "salePercent" INTEGER;

CREATE UNIQUE INDEX "OnecStockItem_slug_key" ON "OnecStockItem"("slug");

ALTER TABLE "OnecCategory" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "OnecCategory_slug_key" ON "OnecCategory"("slug");

-- Trigram fuzzy-search support for OnecStockItem, mirroring StockItem's
-- 20260624000000_add_pg_trgm (extension already enabled there). No fullName
-- column on OnecStockItem, so only name + brand get indexed.
CREATE INDEX IF NOT EXISTS "OnecStockItem_name_trgm_idx"  ON "OnecStockItem" USING GIN (name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "OnecStockItem_brand_trgm_idx" ON "OnecStockItem" USING GIN (brand gin_trgm_ops);
