import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import {
  CreatePositionDto,
  UpdatePositionDto,
  PositionHistoryItemDto,
  LeadershipPositionItemDto,
} from './dto';
import { TeamAdmin } from '../auth/decorators';

@ApiTags('Positions')
@Controller()
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('members/:id/positions')
  @ApiOperation({ summary: 'Get position history for a member' })
  @ApiOkResponse({ type: PositionHistoryItemDto, isArray: true })
  getPositionHistory(@Param('id') id: string) {
    return this.positionsService.getPositionHistory(id);
  }

  @Get('positions/current')
  @ApiOperation({
    summary: 'Get current leadership',
    description:
      'Returns positions where endYear IS NULL AND endMonth IS NULL (ongoing positions)',
  })
  @ApiOkResponse({ type: LeadershipPositionItemDto, isArray: true })
  getCurrentLeadership() {
    return this.positionsService.getCurrentLeadership();
  }

  @Get('positions/year/:year')
  @ApiOperation({
    summary: 'Get leadership by year',
    description:
      'Returns positions active during the specified year (startYear <= year AND (endYear IS NULL OR endYear >= year))',
  })
  @ApiParam({
    name: 'year',
    type: Number,
    description: 'Year to query (2000-2100)',
  })
  @ApiOkResponse({ type: LeadershipPositionItemDto, isArray: true })
  getLeadershipByYear(@Param('year', ParseIntPipe) year: number) {
    return this.positionsService.getLeadershipByYear(year);
  }

  @Post('members/:id/positions')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Assign position to member (Admin only)' })
  @ApiCreatedResponse({ type: LeadershipPositionItemDto })
  create(
    @Param('id') memberId: string,
    @Body() createPositionDto: CreatePositionDto,
  ) {
    return this.positionsService.create(memberId, createPositionDto);
  }

  @Patch('positions/:id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update position (Admin only)' })
  @ApiOkResponse({ type: LeadershipPositionItemDto })
  update(
    @Param('id') id: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ) {
    return this.positionsService.update(id, updatePositionDto);
  }

  @Delete('positions/:id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Remove position (Admin only)' })
  remove(@Param('id') id: string) {
    return this.positionsService.remove(id);
  }
}
