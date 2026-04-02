import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { FindMembersDto, InviteMemberDto, UpdateMemberDto } from './dto';
import { TeamAdmin, TeamMember, CurrentUser } from '../auth/decorators';
import type { TeamUserPrincipal } from '../auth/types';

@ApiTags('Members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List all club members with filters' })
  findAll(@Query() query: FindMembersDto) {
    return this.membersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get member by ID with positions' })
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Post('invite')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Invite a new member (Admin only)',
    description:
      'Sends a Clerk invitation and creates a pending member profile immediately. After invite acceptance, Clerk user.created updates and activates that profile.',
  })
  invite(@Body() inviteMemberDto: InviteMemberDto) {
    return this.membersService.invite(inviteMemberDto);
  }

  @Patch(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update member profile (Self or Admin)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: TeamUserPrincipal,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.update(
      id,
      updateMemberDto,
      user.id,
      user.role === 'admin',
    );
  }

  @Delete(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Remove member (Admin only)' })
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
