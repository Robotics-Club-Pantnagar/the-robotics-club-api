import { BadRequestException, Injectable } from '@nestjs/common';
import { BlogsService } from '../blogs/blogs.service';
import { ProjectsService } from '../projects/projects.service';
import { toUniqueTagSlugs } from '../utils/tag.util';
import {
  FindContentByTagsDto,
  type TagContentTarget,
} from './dto/discovery.dto';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findByTags(query: FindContentByTagsDto) {
    const normalizedTags = toUniqueTagSlugs(query.tags);
    if (normalizedTags.length === 0) {
      throw new BadRequestException(
        'Provide at least one valid tag in the tags array.',
      );
    }

    const target = this.normalizeTarget(query.type);
    const commonQuery = {
      tags: normalizedTags,
      contentView: query.contentView,
      limit: query.limit,
      offset: query.offset,
    };

    if (target === 'blogs') {
      return {
        type: target,
        tags: normalizedTags,
        blogs: await this.blogsService.findAll(commonQuery),
      };
    }

    if (target === 'projects') {
      return {
        type: target,
        tags: normalizedTags,
        projects: await this.projectsService.findAll(commonQuery),
      };
    }

    const [blogs, projects] = await Promise.all([
      this.blogsService.findAll(commonQuery),
      this.projectsService.findAll(commonQuery),
    ]);

    return {
      type: target,
      tags: normalizedTags,
      blogs,
      projects,
    };
  }

  private normalizeTarget(target?: TagContentTarget): TagContentTarget {
    return target ?? 'both';
  }
}
