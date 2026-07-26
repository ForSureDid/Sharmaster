-- Admin-only visibility flag: hides a permanently-unwanted OnecStockItem row from the
-- storefront (e.g. the "Пустой баллон, 50 л ..." deposit variant, id 26224) while it
-- keeps existing as a real 1C offer/row. Same "1C sync must never touch this" pattern
-- as 20260725020000_add_onec_stockitem_admin_fields (isNewPending/stockOverride/
-- priceOverride) — not added to onecImport.ts's ON CONFLICT DO UPDATE SET / UPDATE ...
-- SET column lists. Filtered out of every public read path in lib/onecStock.ts.

ALTER TABLE "OnecStockItem" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
