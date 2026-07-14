-- Обмен заказами с 1С (type=sale): отметки протокола query → success.
-- onecQueuedAt — заказ отдан 1С в mode=query; onecExportedAt — 1С подтвердила
-- получение в mode=success. NULL в onecExportedAt = заказ ещё не выгружен.
-- IF NOT EXISTS — колонки могли быть применены вручную до деплоя (для теста).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "onecQueuedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "onecExportedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_onecExportedAt_idx" ON "Order"("onecExportedAt");

-- Исторические заказы считаем уже выгруженными: в 1С должны попадать только
-- заказы, созданные после включения обмена, а не вся история сайта.
UPDATE "Order" SET "onecExportedAt" = now() WHERE "onecExportedAt" IS NULL;
