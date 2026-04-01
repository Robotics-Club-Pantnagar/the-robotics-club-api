import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import { CreateParticipantDto, UpdateParticipantDto } from './dto';
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
  getMe(@CurrentUser() user: UserPrincipal) {
    return this.participantsService.findByClerkId(user.id);
  }

  @Post('me')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({ summary: 'Create participant profile' })
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
  getMyEvents(@CurrentUser() user: UserPrincipal) {
    return this.participantsService.getRegisteredEvents(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get participant public profile by ID' })
  findOne(@Param('id') id: string) {
    return this.participantsService.findOne(id);
  }
}
