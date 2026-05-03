import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { createUpstashRedisClient } from './upstash-redis.config';

@Injectable()
export class TagSearchRedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();
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
