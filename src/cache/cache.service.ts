import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { createUpstashRedisClient } from './upstash-redis.config';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();
  }

  buildKey(namespace: string, payload: unknown): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${namespace}:${encoded}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get<string>(key);
      if (!value || typeof value !== 'string') {
        return null;
      }

      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } catch {
      // Do not fail API operations when cache writes fail.
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, {
          match: `${prefix}*`,
          count: 200,
        });

        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // Do not fail API operations when cache invalidation fails.
    }
  }

  getClient(): Redis {
    return this.client;
  }

  onModuleDestroy(): void {
    return;
  }

  private createClient(): Redis {
    return createUpstashRedisClient(this.configService);
  }
}
