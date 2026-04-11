export function toStringArrayQuery(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const items = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];

  for (const item of items) {
    if (item === undefined || item === null) {
      continue;
    }

    if (Array.isArray(item)) {
      const nested = toStringArrayQuery(item);
      if (nested && nested.length > 0) {
        normalized.push(...nested);
      }
      continue;
    }

    if (typeof item === 'string') {
      const normalizedItem = item.trim();
      if (normalizedItem.length > 0) {
        normalized.push(normalizedItem);
      }
      continue;
    }

    const asString = String(item).trim();
    if (asString.length > 0) {
      normalized.push(asString);
    }
  }

  return normalized;
}