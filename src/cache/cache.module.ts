import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TagSearchIndexService } from './tag-search-index';
import { ValkeyCacheService } from './valkey-cache.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [ValkeyCacheService, TagSearchIndexService],
  exports: [ValkeyCacheService, TagSearchIndexService],
})
export class CacheModule {}
