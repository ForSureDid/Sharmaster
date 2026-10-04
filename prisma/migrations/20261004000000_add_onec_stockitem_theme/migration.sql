-- Licensed-character/franchise theme ("Minecraft", "Roblox", ...) that the 1C
-- product name itself never names (e.g. "Пиксельный герой", "Блоки, Девочки").
-- Hand-curated by scripts/backfill-theme.ts (GPT-4o-mini vision classification
-- off the product photo), never touched by 1C sync — see the theme column
-- comment in prisma/schema.prisma.

-- AlterTable
ALTER TABLE "OnecStockItem" ADD COLUMN "theme" TEXT;
