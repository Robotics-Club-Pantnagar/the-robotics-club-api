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
import { EventsService } from './events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  FindEventsDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { TeamAdmin, UserAuth, CurrentUser } from '../auth/decorators';
import type { UserPrincipal } from '../auth/types';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List all events with filters and pagination' })
  findAll(@Query() query: FindEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID with schedules' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Create a new event (Admin only)' })
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Patch(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update event (Admin only)' })
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete event (Admin only)' })
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':id/schedules')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Add schedule to event (Admin only)' })
  addSchedule(
    @Param('id') id: string,
    @Body() createScheduleDto: CreateScheduleDto,
  ) {
    return this.eventsService.addSchedule(id, createScheduleDto);
  }

  @Patch(':eventId/schedules/:scheduleId')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update event schedule (Admin only)' })
  updateSchedule(
    @Param('eventId') eventId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.eventsService.updateSchedule(
      eventId,
      scheduleId,
      updateScheduleDto,
    );
  }

  @Delete(':eventId/schedules/:scheduleId')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete event schedule (Admin only)' })
  removeSchedule(
    @Param('eventId') eventId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.eventsService.removeSchedule(eventId, scheduleId);
  }

  @Post(':id/register')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Register for an event as solo participant',
  })
  register(@Param('id') id: string, @CurrentUser() user: UserPrincipal) {
    return this.eventsService.register(id, user.id);
  }

  @Delete(':id/unregister')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Unregister from an event (Authenticated participant)',
  })
  unregister(@Param('id') id: string, @CurrentUser() user: UserPrincipal) {
    return this.eventsService.unregister(id, user.id);
  }

  @Get(':id/participants')
  @ApiOperation({ summary: 'List event participants' })
  getParticipants(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.eventsService.getParticipants(id, query);
  }
}
