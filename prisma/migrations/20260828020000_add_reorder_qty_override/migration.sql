-- Admin-set "Купить, шт" override for the Дозаказ report; null = use the
-- calculated value.
ALTER TABLE "OnecStockItem" ADD COLUMN "reorderQtyOverride" INTEGER;
