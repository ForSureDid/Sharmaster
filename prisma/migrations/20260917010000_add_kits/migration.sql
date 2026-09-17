-- Starter kits ("Набор для новичков") — fixed-price bundles of OnecStockItem lines.
-- See prisma/schema.prisma's Kit/KitItem models for the full comment.

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "kitId" INTEGER,
ADD COLUMN     "kitName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cartKits" JSONB,
ADD COLUMN     "cartKitsUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Kit" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "images" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitItem" (
    "id" SERIAL NOT NULL,
    "kitId" INTEGER NOT NULL,
    "onecStockItemId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KitItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kit_slug_key" ON "Kit"("slug");

-- CreateIndex
CREATE INDEX "KitItem_onecStockItemId_idx" ON "KitItem"("onecStockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "KitItem_kitId_onecStockItemId_key" ON "KitItem"("kitId", "onecStockItemId");

-- CreateIndex
CREATE INDEX "OrderItem_kitId_idx" ON "OrderItem"("kitId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitItem" ADD CONSTRAINT "KitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitItem" ADD CONSTRAINT "KitItem_onecStockItemId_fkey" FOREIGN KEY ("onecStockItemId") REFERENCES "OnecStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
