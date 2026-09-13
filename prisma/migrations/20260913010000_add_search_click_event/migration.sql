-- One row per click on a product while a search query was active (suggestion
-- dropdown or catalog results grid). Logged by lib/searchAnalytics.ts.
CREATE TABLE "SearchClickEvent" (
    "id"              SERIAL NOT NULL,
    "query"           TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "itemId"          INTEGER NOT NULL,
    "source"          TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchClickEvent_normalizedQuery_idx" ON "SearchClickEvent"("normalizedQuery");
CREATE INDEX "SearchClickEvent_itemId_idx" ON "SearchClickEvent"("itemId");
CREATE INDEX "SearchClickEvent_createdAt_idx" ON "SearchClickEvent"("createdAt");
