-- Product characteristic columns backfilled from the Donballon.ru B2B xlsx export
-- (Праздник/Оттенок/Цвет/Группа цвета/Длина/Ширина/Высота). Same "1C doesn't send
-- this, hand-curated, never touched by sync" pattern as packQty/sizeInches — not
-- added to lib/onecImport.ts's upsertProductChunk() INSERT column list or its
-- ON CONFLICT DO UPDATE SET clause. Backfilled by
-- scripts/backfill-onec-characteristics-from-donballon.ts, matching strictly on
-- article + exact full name.

ALTER TABLE "OnecStockItem" ADD COLUMN "occasion" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "shade" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "color" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "colorGroup" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN "lengthMm" INTEGER;
ALTER TABLE "OnecStockItem" ADD COLUMN "widthMm" INTEGER;
ALTER TABLE "OnecStockItem" ADD COLUMN "heightMm" INTEGER;
