-- Add slug column to projects
ALTER TABLE "projects"
ADD COLUMN "slug" TEXT;

-- Backfill unique slugs for existing rows using title
WITH normalized AS (
  SELECT
    "id",
    NULLIF(
      TRIM(BOTH '-' FROM regexp_replace(lower(COALESCE("title", 'project')), '[^a-z0-9]+', '-', 'g')),
      ''
    ) AS "base_slug"
  FROM "projects"
),
ranked AS (
  SELECT
    "id",
    COALESCE("base_slug", 'project') AS "safe_slug",
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE("base_slug", 'project')
      ORDER BY "id"
    ) AS "rn"
  FROM normalized
)
UPDATE "projects" p
SET "slug" = CASE
  WHEN r."rn" = 1 THEN r."safe_slug"
  ELSE r."safe_slug" || '-' || r."rn"
END
FROM ranked r
WHERE p."id" = r."id";

ALTER TABLE "projects"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "projects_slug_key"
ON "projects"("slug");
