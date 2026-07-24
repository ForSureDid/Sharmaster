-- OnecStockItem: imageUrl/images — linked post-sync by scripts/link-onec-images.ts,
-- matched by article to Supabase Storage buckets. Same shape/nullability as StockItem's
-- imageUrl (text, nullable) / images (text[], nullable, no default) columns in prod.
-- IF NOT EXISTS — column may already exist if applied manually before deploy (see house style
-- in 20260714000000_add_order_onec_export).
ALTER TABLE "OnecStockItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "OnecStockItem" ADD COLUMN IF NOT EXISTS "images" TEXT[];
