import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

export const createUpstashRedisClient = (
  configService: ConfigService,
): Redis => {
  const url = configService.get<string>('UPSTASH_REDIS_REST_URL');
  const token = configService.get<string>('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) {
    throw new Error(
      'Missing Upstash Redis REST configuration. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    );
  }

  return new Redis({
    url,
    token,
    automaticDeserialization: false,
  });
};
