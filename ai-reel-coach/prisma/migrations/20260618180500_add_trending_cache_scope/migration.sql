-- Separate trending cache rows by Local/Global scope.
ALTER TABLE "TrendingCache" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'local';

DROP INDEX IF EXISTS "TrendingCache_niche_language_region_date_key";

CREATE UNIQUE INDEX "TrendingCache_niche_language_region_scope_date_key"
ON "TrendingCache"("niche", "language", "region", "scope", "date");