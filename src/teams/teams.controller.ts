import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  SearchEventTeamsDto,
  JoinTeamRequestDto,
  ListJoinRequestsDto,
  ReviewJoinRequestDto,
  TransferLeadershipDto,
} from './dto';
import { UserAuth, CurrentUser } from '../auth/decorators';
import { UserOrTeamAdminGuard } from '../auth/user-or-team-admin.guard';
import type { AuthPrincipal, UserPrincipal } from '../auth/types';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('events/:eventId')
  @ApiOperation({
    summary: 'Look up teams in an event',
    description:
      'Lists teams registered in an event, supports optional name filter, and includes team leader details.',
  })
  @ApiOkResponse({
    description: 'Teams registered in the event',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'leader'],
        properties: {
          id: { type: 'string', example: 'team_123' },
          name: { type: 'string', example: 'Robo Warriors' },
          leader: {
            type: 'object',
            required: ['id', 'name', 'username', 'imageUrl'],
            properties: {
              id: { type: 'string', example: 'user_123' },
              name: { type: 'string', example: 'John Doe' },
              username: { type: 'string', example: 'john_doe' },
              imageUrl: {
                type: 'string',
                format: 'uri',
                example: 'https://example.com/avatar.jpg',
              },
            },
          },
        },
      },
    },
  })
  findByEvent(
    @Param('eventId') eventId: string,
    @Query() query: SearchEventTeamsDto,
  ) {
    return this.teamsService.findByEvent(eventId, query);
  }

  @Post()
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({ summary: 'Create a new team (Authenticated participant)' })
  create(
    @CurrentUser() user: UserPrincipal,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    return this.teamsService.create(user.id, createTeamDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get team by ID with members and registered events',
  })
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({ summary: 'Update team name (Team leader only)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: UserPrincipal,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, user.id, updateTeamDto);
  }

  @Patch(':id/leader')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary:
      'Transfer team leadership to another team member (Current leader only)',
  })
  transferLeadership(
    @Param('id') id: string,
    @CurrentUser() user: UserPrincipal,
    @Body() transferLeadershipDto: TransferLeadershipDto,
  ) {
    return this.teamsService.transferLeadership(
      id,
      user.id,
      transferLeadershipDto,
    );
  }

  @Delete(':id')
  @UseGuards(UserOrTeamAdminGuard)
  @ApiBearerAuth('user-auth')
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete team (Team leader or Admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    const isAdmin = user.type === 'member' && user.role === 'admin';
    return this.teamsService.remove(id, user.id, isAdmin);
  }

  @Post(':id/join-request')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Request to join a team for an event (Participant)',
  })
  requestJoin(
    @Param('id') id: string,
    @CurrentUser() user: UserPrincipal,
    @Body() joinTeamRequestDto: JoinTeamRequestDto,
  ) {
    return this.teamsService.requestJoin(id, user.id, joinTeamRequestDto);
  }

  @Get(':id/join-requests')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'List pending join requests (Team leader only)',
  })
  listJoinRequests(
    @Param('id') id: string,
    @CurrentUser() user: UserPrincipal,
    @Query() query: ListJoinRequestsDto,
  ) {
    return this.teamsService.listJoinRequests(id, user.id, query);
  }

  @Patch(':id/join-requests/:participantId')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Approve or reject a join request (Team leader only)',
  })
  reviewJoinRequest(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: UserPrincipal,
    @Body() reviewJoinRequestDto: ReviewJoinRequestDto,
  ) {
    return this.teamsService.reviewJoinRequest(
      id,
      participantId,
      user.id,
      reviewJoinRequestDto,
    );
  }

  @Delete(':id/members/:participantId')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Remove member from team (Team leader only)',
  })
  removeMember(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: UserPrincipal,
  ) {
    return this.teamsService.removeMember(id, participantId, user.id);
  }
}
