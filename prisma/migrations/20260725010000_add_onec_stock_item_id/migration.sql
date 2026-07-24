-- Storefront cutover: Like/OrderItem gain an OnecStockItem-space FK alongside
-- the legacy StockItem one, so both id spaces can coexist during the switch.

-- Like: surrogate PK (was a composite [userId, stockItemId] key, which can't
-- represent an onecStockItemId-only row), relax stockItemId, add the new FK.
ALTER TABLE "Like" ADD COLUMN "id" SERIAL;
ALTER TABLE "Like" DROP CONSTRAINT "Like_pkey";
ALTER TABLE "Like" ADD CONSTRAINT "Like_pkey" PRIMARY KEY ("id");

ALTER TABLE "Like" ALTER COLUMN "stockItemId" DROP NOT NULL;
ALTER TABLE "Like" ADD COLUMN "onecStockItemId" INTEGER;
ALTER TABLE "Like" ADD CONSTRAINT "Like_onecStockItemId_fkey"
  FOREIGN KEY ("onecStockItemId") REFERENCES "OnecStockItem"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "Like_userId_stockItemId_key" ON "Like"("userId", "stockItemId");
CREATE UNIQUE INDEX "Like_userId_onecStockItemId_key" ON "Like"("userId", "onecStockItemId");
CREATE INDEX "Like_onecStockItemId_idx" ON "Like"("onecStockItemId");

-- Exactly one of the two item FKs must be set per row.
ALTER TABLE "Like" ADD CONSTRAINT "Like_exactly_one_item_chk"
  CHECK ((("stockItemId" IS NOT NULL)::int + ("onecStockItemId" IS NOT NULL)::int) = 1);

-- OrderItem: add the OnecStockItem-space column alongside the existing bare
-- (unenforced) stockItemId column — same nullable, no-FK convention.
ALTER TABLE "OrderItem" ADD COLUMN "onecStockItemId" INTEGER;
