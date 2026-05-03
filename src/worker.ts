import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  const logger = new Logger('WorkerBootstrap');
  logger.log('Worker started');
}

bootstrap().catch((err) => {
  console.error('Fatal worker bootstrap error:', err);
  process.exit(1);
});
