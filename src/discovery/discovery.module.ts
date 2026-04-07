import { Module } from '@nestjs/common';
import { BlogsModule } from '../blogs/blogs.module';
import { ProjectsModule } from '../projects/projects.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [BlogsModule, ProjectsModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
