import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export const queueConfig = registerAs('queue', (): QueueConfig => {
  const redisUrl = process.env.BULLMQ_REDIS_URL;

  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    } catch {
      // Fall back to defaults if URL parsing fails
    }
  }

  return {
    host: process.env.BULLMQ_REDIS_HOST || 'localhost',
    port: parseInt(process.env.BULLMQ_REDIS_PORT || '6379', 10),
    username: process.env.BULLMQ_REDIS_USERNAME || undefined,
    password: process.env.BULLMQ_REDIS_PASSWORD || undefined,
  };
});

export const CERTIFICATE_QUEUE = 'certificate-queue';
