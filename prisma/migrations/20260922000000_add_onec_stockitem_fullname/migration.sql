-- Customer-facing name override for OnecStockItem — see the fullName column
-- comment in prisma/schema.prisma. Hand-curated, never touched by 1C sync.

-- AlterTable
ALTER TABLE "OnecStockItem" ADD COLUMN "fullName" TEXT;
