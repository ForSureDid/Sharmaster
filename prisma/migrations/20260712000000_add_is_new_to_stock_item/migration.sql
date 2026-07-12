-- StockItem: isNew flag (shown on main page) + createdAt
ALTER TABLE "StockItem" ADD COLUMN "isNew" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StockItem" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "StockItem_isNew_idx" ON "StockItem"("isNew");
CREATE INDEX "StockItem_createdAt_idx" ON "StockItem"("createdAt");

-- OnecStockItem: isNew flag (auto-set on first sync insert, stays until admin dismisses)
ALTER TABLE "OnecStockItem" ADD COLUMN "isNew" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "OnecStockItem_isNew_idx" ON "OnecStockItem"("isNew");
