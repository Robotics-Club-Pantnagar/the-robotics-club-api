import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheService } from './cache.service';
import { TagSearchIndexService } from './tag-search-index';
import { TagSearchRedisService } from './tag-search-redis.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [CacheService, TagSearchRedisService, TagSearchIndexService],
  exports: [CacheService, TagSearchRedisService, TagSearchIndexService],
})
export class CacheModule {}
