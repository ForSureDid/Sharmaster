-- Two more product columns backfilled from the Donballon.ru B2B xlsx export
-- (Базовая единица / Вес (грамм)). Same "1C doesn't send this, hand-curated,
-- never touched by sync" pattern as packQty/sizeInches/occasion/shade/color/
-- colorGroup/lengthMm/widthMm/heightMm — not added to lib/onecImport.ts's
-- upsertProductChunk() INSERT column list or its ON CONFLICT DO UPDATE SET
-- clause. Backfilled by
-- scripts/backfill-onec-baseunit-weight-size-from-donballon.ts, matching
-- strictly on article + name (token-diff <= 3), same rule as
-- 20260728000000_add_onec_stockitem_characteristics. That same script also
-- re-backfills the existing sizeInches column from "РазмерДюймов".

ALTER TABLE "OnecStockItem" ADD COLUMN "baseUnit" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "weightGrams" INTEGER;
