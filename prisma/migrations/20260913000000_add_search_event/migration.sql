-- One row per shopper-initiated catalog search (/catalog?q=...), logged by
-- lib/searchAnalytics.ts. Powers the admin "Поиск" tab: popular queries and
-- zero-result queries.
CREATE TABLE "SearchEvent" (
    "id"              SERIAL NOT NULL,
    "query"           TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "resultCount"     INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchEvent_normalizedQuery_idx" ON "SearchEvent"("normalizedQuery");
CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");
CREATE INDEX "SearchEvent_resultCount_idx" ON "SearchEvent"("resultCount");
