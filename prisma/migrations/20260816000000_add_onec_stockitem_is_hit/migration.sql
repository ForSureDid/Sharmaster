-- "Хит продаж" flag, bootstrapped from donballon.ru's own storefront badge (their B2B
-- xlsx/YML export has no such column — confirmed by inspecting both) and later intended
-- to be derived from our own weekly sales aggregation. Same "1C sync must never touch
-- this" pattern as isHidden/packQty/etc — not added to onecImport.ts's INSERT/UPDATE
-- column lists.

ALTER TABLE "OnecStockItem" ADD COLUMN "isHit" BOOLEAN NOT NULL DEFAULT false;
