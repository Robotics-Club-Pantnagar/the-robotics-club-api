import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
}

const toInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDbFromPath = (pathname: string): number | undefined => {
  if (!pathname || pathname === '/') {
    return undefined;
  }

  return toInteger(pathname.slice(1));
};

const parseRedisUrl = (redisUrl: string): QueueConfig | null => {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: toInteger(url.port) ?? 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      db: parseDbFromPath(url.pathname),
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    return null;
  }
};

export const resolveQueueConfig = (
  getValue: (key: string) => string | undefined,
): QueueConfig => {
  const bullMqUrl = getValue('BULLMQ_REDIS_URL');
  if (bullMqUrl) {
    const parsed = parseRedisUrl(bullMqUrl);
    if (parsed) {
      return parsed;
    }
  }

  const valkeyUrl = getValue('VALKEY_URL');
  if (valkeyUrl) {
    const parsed = parseRedisUrl(valkeyUrl);
    if (parsed) {
      return parsed;
    }
  }

  const host = getValue('BULLMQ_REDIS_HOST') || getValue('VALKEY_HOST');
  const port =
    toInteger(getValue('BULLMQ_REDIS_PORT')) ??
    toInteger(getValue('VALKEY_PORT'));
  const username =
    getValue('BULLMQ_REDIS_USERNAME') || getValue('VALKEY_USERNAME');
  const password =
    getValue('BULLMQ_REDIS_PASSWORD') || getValue('VALKEY_PASSWORD');
  const db =
    toInteger(getValue('BULLMQ_REDIS_DB')) ?? toInteger(getValue('VALKEY_DB'));

  return {
    host: host || 'localhost',
    port: port ?? 6379,
    username: username || undefined,
    password: password || undefined,
    db,
  };
};

export const queueConfig = registerAs(
  'queue',
  (): QueueConfig => resolveQueueConfig((key) => process.env[key]),
);

export const CERTIFICATE_QUEUE = 'certificate-queue';
