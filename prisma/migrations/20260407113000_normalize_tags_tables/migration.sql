-- Normalize blog/project tags into relational tables.

CREATE TABLE "tags" (
  "id" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE FUNCTION normalize_tag_value()
RETURNS TRIGGER AS $$
BEGIN
  NEW."tag" := lower(regexp_replace(trim(COALESCE(NEW."tag", '')), '[^a-z0-9]+', '-', 'g'));
  NEW."tag" := trim(BOTH '-' FROM NEW."tag");

  IF NEW."tag" = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Tag cannot be empty after normalization';
  END IF;

  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tags_normalize_before_write
BEFORE INSERT OR UPDATE OF "tag"
ON "tags"
FOR EACH ROW
EXECUTE FUNCTION normalize_tag_value();

CREATE TABLE "blog_tags" (
  "id" TEXT NOT NULL,
  "blogId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_tags" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_tag_key" ON "tags"("tag");

CREATE UNIQUE INDEX "blog_tags_blogId_tagId_key" ON "blog_tags"("blogId", "tagId");
CREATE INDEX "blog_tags_blogId_idx" ON "blog_tags"("blogId");
CREATE INDEX "blog_tags_tagId_idx" ON "blog_tags"("tagId");

CREATE UNIQUE INDEX "project_tags_projectId_tagId_key" ON "project_tags"("projectId", "tagId");
CREATE INDEX "project_tags_projectId_idx" ON "project_tags"("projectId");
CREATE INDEX "project_tags_tagId_idx" ON "project_tags"("tagId");

ALTER TABLE "blog_tags"
ADD CONSTRAINT "blog_tags_blogId_fkey"
FOREIGN KEY ("blogId") REFERENCES "blogs"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "blog_tags"
ADD CONSTRAINT "blog_tags_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "tags"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "project_tags"
ADD CONSTRAINT "project_tags_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "project_tags"
ADD CONSTRAINT "project_tags_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "tags"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Build canonical slug set from existing blog/project tag arrays.
WITH raw_tags AS (
  SELECT DISTINCT unnest(COALESCE("tags", ARRAY[]::TEXT[])) AS raw_tag FROM "blogs"
  UNION
  SELECT DISTINCT unnest(COALESCE("tags", ARRAY[]::TEXT[])) AS raw_tag FROM "projects"
), normalized_tags AS (
  SELECT
    TRIM(raw_tag) AS tag_name,
    NULLIF(
      TRIM(BOTH '-' FROM regexp_replace(lower(TRIM(raw_tag)), '[^a-z0-9]+', '-', 'g')),
      ''
    ) AS slug
  FROM raw_tags
  WHERE TRIM(raw_tag) <> ''
), deduped_tags AS (
  SELECT DISTINCT slug
  FROM normalized_tags
  WHERE slug IS NOT NULL
)
INSERT INTO "tags" ("id", "tag", "createdAt", "updatedAt")
SELECT
  'tag_' || substring(md5(slug) FOR 24),
  slug,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM deduped_tags;

-- Populate blog_tags links from existing arrays.
WITH exploded_blog_tags AS (
  SELECT
    b."id" AS blog_id,
    NULLIF(
      TRIM(BOTH '-' FROM regexp_replace(lower(TRIM(raw_tag)), '[^a-z0-9]+', '-', 'g')),
      ''
    ) AS slug
  FROM "blogs" b
  CROSS JOIN LATERAL unnest(COALESCE(b."tags", ARRAY[]::TEXT[])) AS raw_tag
  WHERE TRIM(raw_tag) <> ''
), distinct_blog_links AS (
  SELECT DISTINCT blog_id, slug
  FROM exploded_blog_tags
  WHERE slug IS NOT NULL
)
INSERT INTO "blog_tags" ("id", "blogId", "tagId", "createdAt")
SELECT
  'bt_' || substring(md5(l.blog_id || ':' || t."id") FOR 24),
  l.blog_id,
  t."id",
  CURRENT_TIMESTAMP
FROM distinct_blog_links l
JOIN "tags" t ON t."tag" = l.slug;

-- Populate project_tags links from existing arrays.
WITH exploded_project_tags AS (
  SELECT
    p."id" AS project_id,
    NULLIF(
      TRIM(BOTH '-' FROM regexp_replace(lower(TRIM(raw_tag)), '[^a-z0-9]+', '-', 'g')),
      ''
    ) AS slug
  FROM "projects" p
  CROSS JOIN LATERAL unnest(COALESCE(p."tags", ARRAY[]::TEXT[])) AS raw_tag
  WHERE TRIM(raw_tag) <> ''
), distinct_project_links AS (
  SELECT DISTINCT project_id, slug
  FROM exploded_project_tags
  WHERE slug IS NOT NULL
)
INSERT INTO "project_tags" ("id", "projectId", "tagId", "createdAt")
SELECT
  'pt_' || substring(md5(l.project_id || ':' || t."id") FOR 24),
  l.project_id,
  t."id",
  CURRENT_TIMESTAMP
FROM distinct_project_links l
JOIN "tags" t ON t."tag" = l.slug;

ALTER TABLE "blogs" DROP COLUMN "tags";
ALTER TABLE "projects" DROP COLUMN "tags";
