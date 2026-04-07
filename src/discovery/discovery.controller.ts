import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TeamMember } from '../auth/decorators';
import {
  type TagSuggestion,
  TagSearchIndexService,
} from '../cache/tag-search-index';
import { FindContentByTagsDto } from './dto/discovery.dto';
import { DiscoveryService } from './discovery.service';

type TagSearchResponse = {
  query: string;
  items: TagSuggestion[];
};

@ApiTags('Discovery')
@Controller('discover')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly tagSearchService: TagSearchIndexService,
  ) {}

  @Get('by-tags')
  @ApiOperation({
    summary: 'Get blogs, projects, or both by array of tags',
  })
  findByTags(@Query() query: FindContentByTagsDto) {
    return this.discoveryService.findByTags(query);
  }

  @Get('tags')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary:
      'Search tag suggestions for blog/project editors (member-only endpoint)',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Free-text query for tag suggestions',
    example: 'first thir',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of tag suggestions to return',
    example: 10,
  })
  async searchTags(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<TagSearchResponse> {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('q query parameter is required');
    }

    const parsedLimit = Number(limit);
    const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 10;

    return {
      query: q,
      items: await this.tagSearchService.searchTags(q, normalizedLimit),
    };
  }
}
