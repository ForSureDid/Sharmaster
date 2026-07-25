-- Admin panel cutover to OnecStockItem: fields the admin UI needs that 1C sync
-- must never overwrite. Same pattern as 20260725000000_add_onec_stockitem_pack_slug_sale
-- (none of these are added to onecImport.ts's ON CONFLICT DO UPDATE SET).
--
-- isNewPending: "Ожидайте поступления" pre-arrival flag, mirrors old StockItem.isNewPending.
-- stockOverride/priceOverride: true once an admin manually edits stock/price for this
-- row — lib/onecImport.ts's updateOfferChunk() then skips that column on future syncs.

ALTER TABLE "OnecStockItem" ADD COLUMN "isNewPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnecStockItem" ADD COLUMN "stockOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnecStockItem" ADD COLUMN "priceOverride" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "OnecStockItem_isNewPending_idx" ON "OnecStockItem"("isNewPending");
