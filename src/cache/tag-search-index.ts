import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toUniqueTagSlugs } from '../utils/tag.util';
import { TagSearchRedisService } from './tag-search-redis.service';

export type TagSuggestion = {
  tag: string;
  normalized: string;
  popularity: number;
};

@Injectable()
export class TagSearchIndexService {
  private readonly logger = new Logger(TagSearchIndexService.name);
  private readonly indexName = 'idx:tags';
  private readonly documentPrefix = 'tags:doc:';
  private readonly popularityKey = 'tags:popularity';

  private rediSearchSupport: 'unknown' | 'available' | 'unavailable' =
    'unknown';
  private seedPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tagSearchRedisService: TagSearchRedisService,
  ) {}

  async onContentCreated(tags?: string[]): Promise<void> {
    await this.applyPopularityDelta(tags, 1);
  }

  async onContentDeleted(tags?: string[]): Promise<void> {
    await this.applyPopularityDelta(tags, -1);
  }

  async onTagsReconciled(
    addedTags?: string[],
    removedTags?: string[],
  ): Promise<void> {
    await Promise.all([
      this.applyPopularityDelta(addedTags, 1),
      this.applyPopularityDelta(removedTags, -1),
    ]);
  }

  async searchTags(rawQuery: string, limit = 10): Promise<TagSuggestion[]> {
    const normalizedQuery = this.normalizeSearchInput(rawQuery);
    if (!normalizedQuery) {
      return [];
    }

    const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || 10, 1), 25);

    await this.seedFromDatabaseIfNeeded();

    try {
      const indexedResults = await this.searchWithRediSearch(
        normalizedQuery,
        normalizedLimit,
      );

      if (indexedResults.length > 0) {
        return indexedResults;
      }
    } catch (error) {
      this.logger.warn(
        `RediSearch query failed, falling back to in-memory scoring: ${this.getErrorMessage(error)}`,
      );
    }

    return this.searchWithFallback(normalizedQuery, normalizedLimit);
  }

  private async applyPopularityDelta(
    tags: string[] | undefined,
    delta: 1 | -1,
  ): Promise<void> {
    const normalizedTags = toUniqueTagSlugs(tags);
    if (normalizedTags.length === 0) {
      return;
    }

    try {
      const client = await this.tagSearchRedisService.getClient();

      for (const tag of normalizedTags) {
        const key = this.getDocumentKey(tag);
        const exists = await client.exists(key);

        if (exists === 0) {
          const popularity = await this.countTagUsage(tag);
          if (popularity <= 0) {
            await client.del(key);
            await client.zrem(this.popularityKey, tag);
            continue;
          }

          await this.writeTagDocument(tag, popularity);
          continue;
        }

        const popularity = await client.hincrby(key, 'popularity', delta);
        const numericPopularity = Number(popularity);

        if (!Number.isFinite(numericPopularity) || numericPopularity <= 0) {
          await client.del(key);
          await client.zrem(this.popularityKey, tag);
          continue;
        }

        await client.hset(
          key,
          'tag',
          tag,
          'normalized',
          this.toNormalizedTag(tag),
          'popularity',
          String(numericPopularity),
        );
        await client.zadd(this.popularityKey, numericPopularity, tag);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to update tag popularity index: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async seedFromDatabaseIfNeeded(): Promise<void> {
    if (this.seedPromise) {
      await this.seedPromise;
      return;
    }

    this.seedPromise = this.seedFromDatabaseIfNeededInternal().finally(() => {
      this.seedPromise = null;
    });

    await this.seedPromise;
  }

  private async seedFromDatabaseIfNeededInternal(): Promise<void> {
    try {
      const client = await this.tagSearchRedisService.getClient();
      const existingCount = await client.zcard(this.popularityKey);
      if (existingCount > 0) {
        return;
      }

      const tags = await this.prisma.tag.findMany({
        select: {
          tag: true,
          _count: {
            select: {
              blogs: true,
              projects: true,
            },
          },
        },
      });

      if (tags.length === 0) {
        return;
      }

      const pipeline = client.pipeline();

      for (const entry of tags) {
        const popularity = entry._count.blogs + entry._count.projects;
        if (popularity <= 0) {
          continue;
        }

        const key = this.getDocumentKey(entry.tag);
        pipeline.hset(
          key,
          'tag',
          entry.tag,
          'normalized',
          this.toNormalizedTag(entry.tag),
          'popularity',
          String(popularity),
        );
        pipeline.zadd(this.popularityKey, popularity, entry.tag);
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.warn(
        `Failed to seed Redis tag index from DB: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async writeTagDocument(
    tag: string,
    popularity: number,
  ): Promise<void> {
    const client = await this.tagSearchRedisService.getClient();
    const key = this.getDocumentKey(tag);

    await client.hset(
      key,
      'tag',
      tag,
      'normalized',
      this.toNormalizedTag(tag),
      'popularity',
      String(popularity),
    );
    await client.zadd(this.popularityKey, popularity, tag);
  }

  private async countTagUsage(tag: string): Promise<number> {
    const row = await this.prisma.tag.findUnique({
      where: { tag },
      select: {
        _count: {
          select: {
            blogs: true,
            projects: true,
          },
        },
      },
    });

    if (!row) {
      return 0;
    }

    return row._count.blogs + row._count.projects;
  }

  private async searchWithRediSearch(
    normalizedQuery: string,
    limit: number,
  ): Promise<TagSuggestion[]> {
    const supported = await this.ensureRediSearchIndex();
    if (!supported) {
      return [];
    }

    const terms = normalizedQuery.split(' ').filter(Boolean);
    if (terms.length === 0) {
      return [];
    }

    const query = terms
      .map((term) => {
        const escaped = this.escapeRediSearchTerm(term);
        return `@normalized:(${escaped}*|%${escaped}%|%%${escaped}%%)`;
      })
      .join(' ');

    const client = await this.tagSearchRedisService.getClient();
    const raw = await client.call(
      'FT.SEARCH',
      this.indexName,
      query,
      'SORTBY',
      'popularity',
      'DESC',
      'LIMIT',
      '0',
      String(limit),
      'RETURN',
      '3',
      'tag',
      'normalized',
      'popularity',
      'DIALECT',
      '2',
    );

    return this.parseRediSearchResponse(raw);
  }

  private async searchWithFallback(
    normalizedQuery: string,
    limit: number,
  ): Promise<TagSuggestion[]> {
    try {
      const client = await this.tagSearchRedisService.getClient();
      const zsetEntries = await client.zrevrange(
        this.popularityKey,
        0,
        999,
        'WITHSCORES',
      );

      if (zsetEntries.length === 0) {
        return [];
      }

      const tags: string[] = [];
      const popularityByTag = new Map<string, number>();

      for (let i = 0; i < zsetEntries.length; i += 2) {
        const tag = zsetEntries[i];
        const popularity = Number(zsetEntries[i + 1] ?? 0);
        tags.push(tag);
        popularityByTag.set(tag, Number.isFinite(popularity) ? popularity : 0);
      }

      const pipeline = client.pipeline();
      for (const tag of tags) {
        pipeline.hgetall(this.getDocumentKey(tag));
      }

      const hashResults = await pipeline.exec();
      const candidates: Array<TagSuggestion & { score: number }> = [];
      const queryTokens = normalizedQuery.split(' ').filter(Boolean);

      for (let i = 0; i < tags.length; i += 1) {
        const tag = tags[i];
        const fallbackPopularity = popularityByTag.get(tag) ?? 0;

        const hash = hashResults?.[i]?.[1] as
          | Record<string, string>
          | undefined;
        const normalized =
          hash?.normalized && hash.normalized.trim().length > 0
            ? hash.normalized
            : this.toNormalizedTag(tag);
        const popularity = Number(hash?.popularity ?? fallbackPopularity);
        const numericPopularity = Number.isFinite(popularity) ? popularity : 0;

        const relevance = this.getRelevanceScore(queryTokens, normalized);
        if (relevance <= 0) {
          continue;
        }

        candidates.push({
          tag,
          normalized,
          popularity: numericPopularity,
          score: relevance * 1000 + numericPopularity,
        });
      }

      candidates.sort((a, b) => b.score - a.score);

      return candidates
        .slice(0, limit)
        .map(({ tag, normalized, popularity }) => ({
          tag,
          normalized,
          popularity,
        }));
    } catch {
      return [];
    }
  }

  private getRelevanceScore(
    queryTokens: string[],
    normalizedTag: string,
  ): number {
    const tagTokens = normalizedTag.split(' ').filter(Boolean);
    if (queryTokens.length === 0 || tagTokens.length === 0) {
      return 0;
    }

    let score = 0;

    for (const queryToken of queryTokens) {
      let bestTokenScore = 0;

      for (const tagToken of tagTokens) {
        bestTokenScore = Math.max(
          bestTokenScore,
          this.scoreTokenMatch(queryToken, tagToken),
        );
      }

      if (bestTokenScore <= 0) {
        return 0;
      }

      score += bestTokenScore;
    }

    return score;
  }

  private scoreTokenMatch(queryToken: string, tagToken: string): number {
    if (tagToken === queryToken) {
      return 6;
    }

    if (tagToken.startsWith(queryToken)) {
      return 5;
    }

    if (tagToken.includes(queryToken)) {
      return 4;
    }

    const distance = this.levenshteinDistance(queryToken, tagToken);
    if (distance <= 1) {
      return 3;
    }

    const fuzzyThreshold = queryToken.length >= 6 ? 2 : 1;
    if (distance <= fuzzyThreshold) {
      return 2;
    }

    return 0;
  }

  private levenshteinDistance(left: string, right: string): number {
    if (left === right) {
      return 0;
    }

    if (!left.length) {
      return right.length;
    }

    if (!right.length) {
      return left.length;
    }

    const previous = new Array<number>(right.length + 1);
    const current = new Array<number>(right.length + 1);

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = j;
    }

    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;

      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost,
        );
      }

      for (let j = 0; j <= right.length; j += 1) {
        previous[j] = current[j];
      }
    }

    return previous[right.length];
  }

  private async ensureRediSearchIndex(): Promise<boolean> {
    if (this.rediSearchSupport === 'available') {
      return true;
    }

    if (this.rediSearchSupport === 'unavailable') {
      return false;
    }

    try {
      const client = await this.tagSearchRedisService.getClient();
      await client.call(
        'FT.CREATE',
        this.indexName,
        'ON',
        'HASH',
        'PREFIX',
        '1',
        this.documentPrefix,
        'SCHEMA',
        'tag',
        'TAG',
        'normalized',
        'TEXT',
        'popularity',
        'NUMERIC',
        'SORTABLE',
      );

      this.rediSearchSupport = 'available';
      return true;
    } catch (error) {
      const message = this.getErrorMessage(error).toLowerCase();

      if (message.includes('index already exists')) {
        this.rediSearchSupport = 'available';
        return true;
      }

      if (
        message.includes('unknown command') ||
        message.includes('no such module') ||
        message.includes('module disabled')
      ) {
        this.rediSearchSupport = 'unavailable';
        this.logger.warn(
          'RediSearch is not available in Redis; using fallback search scoring.',
        );
        return false;
      }

      this.logger.warn(
        `Failed to initialize RediSearch index: ${this.getErrorMessage(error)}`,
      );
      return false;
    }
  }

  private parseRediSearchResponse(raw: unknown): TagSuggestion[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const rawEntries = raw as unknown[];
    const suggestions: TagSuggestion[] = [];

    for (let i = 1; i < rawEntries.length; i += 2) {
      const fields = rawEntries[i + 1];
      if (!Array.isArray(fields)) {
        continue;
      }

      const fieldPairs = fields as unknown[];
      const record: Record<string, string> = {};
      for (let j = 0; j < fieldPairs.length; j += 2) {
        const key = this.toRedisString(fieldPairs[j]);
        const value = fieldPairs[j + 1];

        if (!key) {
          continue;
        }

        record[key] = this.toRedisString(value);
      }

      const tag = record.tag?.trim();
      if (!tag) {
        continue;
      }

      const popularity = Number(record.popularity ?? 0);

      suggestions.push({
        tag,
        normalized:
          record.normalized?.trim().length > 0
            ? record.normalized
            : this.toNormalizedTag(tag),
        popularity: Number.isFinite(popularity) ? popularity : 0,
      });
    }

    return suggestions;
  }

  private getDocumentKey(tag: string): string {
    return `${this.documentPrefix}${tag}`;
  }

  private toNormalizedTag(tag: string): string {
    return tag.replace(/-/g, ' ');
  }

  private normalizeSearchInput(input: string): string {
    return input
      .toLowerCase()
      .replace(/-/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeRediSearchTerm(term: string): string {
    return term;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  private toRedisString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    if (value instanceof Buffer) {
      return value.toString('utf8');
    }

    return '';
  }
}
