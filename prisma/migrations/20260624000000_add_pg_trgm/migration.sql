-- Enable PostgreSQL trigram extension for fuzzy/typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes on the columns we search — makes similarity() fast on large tables
CREATE INDEX IF NOT EXISTS "StockItem_name_trgm_idx"     ON "StockItem" USING GIN (name         gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "StockItem_fullName_trgm_idx" ON "StockItem" USING GIN ("fullName"   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "StockItem_brand_trgm_idx"    ON "StockItem" USING GIN (brand        gin_trgm_ops);
