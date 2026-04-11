import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TagSearchIndexService } from './tag-search-index';
import { TagSearchRedisService } from './tag-search-redis.service';
import { ValkeyCacheService } from './valkey-cache.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [ValkeyCacheService, TagSearchRedisService, TagSearchIndexService],
  exports: [ValkeyCacheService, TagSearchRedisService, TagSearchIndexService],
})
export class CacheModule {}
