-- Daily point-in-time copy of OnecStockItem.stock, used as a channel-agnostic
-- consumption proxy for reorder recommendations (lib/reorderReport.ts).
CREATE TABLE "StockSnapshot" (
    "id"              SERIAL NOT NULL,
    "onecStockItemId" INTEGER NOT NULL,
    "stock"           INTEGER NOT NULL,
    "capturedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockSnapshot_onecStockItemId_capturedAt_idx" ON "StockSnapshot"("onecStockItemId", "capturedAt");

ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_onecStockItemId_fkey" FOREIGN KEY ("onecStockItemId") REFERENCES "OnecStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
