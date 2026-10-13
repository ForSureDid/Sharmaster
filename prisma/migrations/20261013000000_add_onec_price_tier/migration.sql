-- Per-item 1C price tier. priceTierId pins which <Цена ИдТипаЦены> the sync uses for the item;
-- priceTargetHint is the price from the 1C "Оценка склада" report, used once to learn the tier.
ALTER TABLE "OnecStockItem" ADD COLUMN IF NOT EXISTS "priceTierId" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN IF NOT EXISTS "priceTargetHint" DECIMAL(65,30);
