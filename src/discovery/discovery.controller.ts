import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindContentByTagsDto } from './dto/discovery.dto';
import { DiscoveryService } from './discovery.service';

@ApiTags('Discovery')
@Controller('discover')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('by-tags')
  @ApiOperation({
    summary: 'Get blogs, projects, or both by array of tags',
  })
  findByTags(@Query() query: FindContentByTagsDto) {
    return this.discoveryService.findByTags(query);
  }
}
