-- OnecCategory: mirrors 1C's Классификатор group tree (arbitrary depth) so the
-- admin "Дерево 1С" view can browse OnecStockItem the same way 1C organizes it.
-- Isolated from the live storefront Category model — same spirit as OnecStockItem
-- itself. IF NOT EXISTS / duplicate_object guards — see house style in
-- 20260714000000_add_order_onec_export and 20260724000000_add_images_to_onec_stock_item.

CREATE TABLE IF NOT EXISTS "OnecCategory" (
    "id"        SERIAL NOT NULL,
    "onecId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "parentId"  INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnecCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OnecCategory_onecId_key" ON "OnecCategory"("onecId");
CREATE INDEX IF NOT EXISTS "OnecCategory_parentId_idx" ON "OnecCategory"("parentId");

DO $$ BEGIN
  ALTER TABLE "OnecCategory" ADD CONSTRAINT "OnecCategory_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "OnecCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OnecStockItem" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;
CREATE INDEX IF NOT EXISTS "OnecStockItem_categoryId_idx" ON "OnecStockItem"("categoryId");

DO $$ BEGIN
  ALTER TABLE "OnecStockItem" ADD CONSTRAINT "OnecStockItem_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "OnecCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
