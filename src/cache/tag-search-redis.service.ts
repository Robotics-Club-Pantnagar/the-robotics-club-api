import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class TagSearchRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(TagSearchRedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();

    this.client.on('error', (error) => {
      this.logger.warn(`Tag search Redis error: ${error.message}`);
    });
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

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      return new Redis(redisUrl, commonOptions);
    }

    return new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      username: this.configService.get<string>('REDIS_USERNAME') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      ...commonOptions,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }
}
