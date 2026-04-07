import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { queueConfig, CERTIFICATE_QUEUE } from './queue.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(queueConfig),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('BULLMQ_REDIS_URL');

        if (redisUrl) {
          try {
            const url = new URL(redisUrl);
            return {
              connection: {
                host: url.hostname,
                port: parseInt(url.port, 10) || 6379,
                username: url.username || undefined,
                password: url.password || undefined,
                tls: url.protocol === 'rediss:' ? {} : undefined,
              },
            };
          } catch {
            // Fall back to individual config
          }
        }

        return {
          connection: {
            host: configService.get<string>('BULLMQ_REDIS_HOST', 'localhost'),
            port: configService.get<number>('BULLMQ_REDIS_PORT', 6379),
            username:
              configService.get<string>('BULLMQ_REDIS_USERNAME') || undefined,
            password:
              configService.get<string>('BULLMQ_REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: CERTIFICATE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
