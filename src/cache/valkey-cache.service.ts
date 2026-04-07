import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class ValkeyCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ValkeyCacheService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();

    this.client.on('error', (error) => {
      this.logger.warn(`Valkey cache error: ${error.message}`);
    });
  }

  buildKey(namespace: string, payload: unknown): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${namespace}:${encoded}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnected();
      const value = await this.client.get(key);
      if (!value) {
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
      await this.ensureConnected();
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Do not fail API operations when cache writes fail.
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      await this.ensureConnected();

      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          200,
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // Do not fail API operations when cache invalidation fails.
    }
  }

  async getClient(): Promise<Redis> {
    await this.ensureConnected();
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.status === 'end') {
        return;
      }

      if (this.client.status === 'wait') {
        this.client.disconnect();
        return;
      }

      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private createClient(): Redis {
    const commonOptions: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    };

    const valkeyUrl = this.configService.get<string>('VALKEY_URL');
    if (valkeyUrl) {
      return new Redis(valkeyUrl, commonOptions);
    }

    return new Redis({
      host: this.configService.get<string>('VALKEY_HOST', 'localhost'),
      port: this.configService.get<number>('VALKEY_PORT', 6379),
      password: this.configService.get<string>('VALKEY_PASSWORD') || undefined,
      username: this.configService.get<string>('VALKEY_USERNAME') || undefined,
      db: this.configService.get<number>('VALKEY_DB', 0),
      ...commonOptions,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }
}
