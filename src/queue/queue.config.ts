import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
}

export const queueConfig = registerAs('queue', (): QueueConfig => {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password || undefined,
      };
    } catch {
      // Fall back to defaults if URL parsing fails
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
});

export const CERTIFICATE_QUEUE = 'certificate-queue';
