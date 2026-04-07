import slugify from 'slugify';

export function toTagSlug(input: string): string {
  const slug = slugify(input, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });

  return slug.trim();
}

export function toUniqueTagSlugs(tags?: string[]): string[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  const unique = new Set<string>();

  for (const rawTag of tags) {
    const slug = toTagSlug(rawTag ?? '');
    if (!slug) {
      continue;
    }

    unique.add(slug);
  }

  return [...unique];
}
