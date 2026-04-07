import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ValkeyCacheService } from './valkey-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ValkeyCacheService],
  exports: [ValkeyCacheService],
})
export class CacheModule {}
