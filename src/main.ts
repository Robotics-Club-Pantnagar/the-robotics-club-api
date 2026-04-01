import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import {
  HttpExceptionFilter,
  PrismaExceptionFilter,
  PrismaValidationFilter,
  PrismaUnknownExceptionFilter,
  AllExceptionsFilter,
  ResponseWrapperInterceptor,
} from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filters (order matters - most specific first)
  app.useGlobalFilters(
    new PrismaValidationFilter(),
    new PrismaUnknownExceptionFilter(),
    new PrismaExceptionFilter(),
    new HttpExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // Global response wrapper
  app.useGlobalInterceptors(new ResponseWrapperInterceptor());

  // Enable CORS
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
