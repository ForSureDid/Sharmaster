-- Enable pgvector for semantic/vector search fallback (query embeddings vs. product embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- text-embedding-3-small produces 1536-dim vectors
ALTER TABLE "OnecStockItem" ADD COLUMN "embedding" vector(1536);

-- HNSW cosine-distance index — used by the `<=>` operator in getVectorItemIds()
CREATE INDEX IF NOT EXISTS "OnecStockItem_embedding_idx"
  ON "OnecStockItem" USING hnsw (embedding vector_cosine_ops);
