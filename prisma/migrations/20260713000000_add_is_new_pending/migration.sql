-- StockItem: isNewPending flag for pre-arrival "Ожидайте поступления" state
ALTER TABLE "StockItem" ADD COLUMN "isNewPending" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "StockItem_isNewPending_idx" ON "StockItem"("isNewPending");
