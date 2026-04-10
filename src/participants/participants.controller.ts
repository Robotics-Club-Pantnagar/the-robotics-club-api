import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  ParticipantProfileDto,
  ParticipantRegisteredEventDto,
} from './dto';
import { UserAuth, CurrentUser } from '../auth/decorators';
import type { UserPrincipal } from '../auth/types';

@ApiTags('Participants')
@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get('me')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({ summary: 'Get current participant profile' })
  @ApiOkResponse({ type: ParticipantProfileDto })
  getMe(@CurrentUser() user: UserPrincipal) {
    return this.participantsService.findByClerkId(user.id);
  }

  @Post('signup')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Signup participant profile',
    description:
      'Creates participant profile using Clerk JWT (Authorization header) and signup fields from request body.',
  })
  @ApiCreatedResponse({ type: ParticipantProfileDto })
  createProfile(
    @CurrentUser() user: UserPrincipal,
    @Body() createParticipantDto: CreateParticipantDto,
  ) {
    return this.participantsService.create(user.id, createParticipantDto);
  }

  @Patch('me')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({ summary: 'Update participant profile' })
  @ApiOkResponse({ type: ParticipantProfileDto })
  updateProfile(
    @CurrentUser() user: UserPrincipal,
    @Body() updateParticipantDto: UpdateParticipantDto,
  ) {
    return this.participantsService.update(user.id, updateParticipantDto);
  }

  @Get('me/events')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({ summary: 'Get events registered by current participant' })
  @ApiOkResponse({ type: [ParticipantRegisteredEventDto] })
  getMyEvents(@CurrentUser() user: UserPrincipal) {
    return this.participantsService.getRegisteredEvents(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get participant public profile by ID' })
  @ApiOkResponse({ type: ParticipantProfileDto })
  findOne(@Param('id') id: string) {
    return this.participantsService.findOne(id);
  }
}
