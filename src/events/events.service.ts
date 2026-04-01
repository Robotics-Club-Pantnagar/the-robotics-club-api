import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEventDto,
  UpdateEventDto,
  FindEventsDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto';
import { PaginatedResponse, PaginationDto } from '../common/dto';
import { Event } from '../generated/prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: FindEventsDto): Promise<PaginatedResponse<Event>> {
    const {
      search,
      eventType,
      hasTeam,
      upcoming,
      past,
      limit = 20,
      offset = 0,
    } = query;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (hasTeam !== undefined) {
      where.hasTeam = hasTeam;
    }

    if (upcoming) {
      where.AND = [
        { registrationDeadline: { gt: now } },
        { schedule: { some: { day: { gte: today } } } },
      ];
    }

    if (past) {
      where.schedule = { every: { day: { lt: today } } };
    }

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          schedule: true,
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        schedule: { orderBy: { day: 'asc' } },
        _count: { select: { participants: true, teams: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      ...event,
      participantCount: event._count.participants,
      teamCount: event._count.teams,
      _count: undefined,
    };
  }

  async create(data: CreateEventDto) {
    const { registrationDeadline, ...rest } = data;

    if (data.hasTeam && !data.maxTeamMembers) {
      throw new BadRequestException(
        'maxTeamMembers is required when hasTeam is true',
      );
    }

    return this.prisma.event.create({
      data: {
        ...rest,
        registrationDeadline: new Date(registrationDeadline),
      },
    });
  }

  async update(id: string, data: UpdateEventDto) {
    await this.findOne(id);
    const { registrationDeadline, ...rest } = data;

    return this.prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(registrationDeadline && {
          registrationDeadline: new Date(registrationDeadline),
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.event.delete({ where: { id } });
  }

  // Schedule methods
  async addSchedule(eventId: string, data: CreateScheduleDto) {
    await this.findOne(eventId);
    return this.prisma.eventSchedule.create({
      data: {
        eventId,
        day: new Date(data.day),
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        notes: data.notes,
      },
    });
  }

  async updateSchedule(
    eventId: string,
    scheduleId: string,
    data: UpdateScheduleDto,
  ) {
    const schedule = await this.prisma.eventSchedule.findFirst({
      where: { id: scheduleId, eventId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const { day, ...rest } = data;
    return this.prisma.eventSchedule.update({
      where: { id: scheduleId },
      data: {
        ...rest,
        ...(day && { day: new Date(day) }),
      },
    });
  }

  async removeSchedule(eventId: string, scheduleId: string) {
    const schedule = await this.prisma.eventSchedule.findFirst({
      where: { id: scheduleId, eventId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.prisma.eventSchedule.delete({ where: { id: scheduleId } });
  }

  // Participation methods
  async register(eventId: string, participantId: string) {
    const event = await this.findOne(eventId);

    // Check if already registered
    const existing = await this.prisma.eventParticipant.findUnique({
      where: { eventId_participantId: { eventId, participantId } },
    });

    if (existing) {
      throw new ConflictException('Already registered for this event');
    }

    // Check registration deadline
    if (new Date() > event.registrationDeadline) {
      throw new ConflictException('Registration deadline has passed');
    }

    // Check max participants
    if (event.maxParticipants) {
      const participantCount = await this.prisma.eventParticipant.count({
        where: { eventId },
      });
      if (participantCount >= event.maxParticipants) {
        throw new ConflictException('Event has reached maximum capacity');
      }
    }

    return this.prisma.eventParticipant.create({
      data: {
        eventId,
        participantId,
        teamId: null,
      },
      include: {
        event: true,
        participant: true,
        team: true,
      },
    });
  }

  async unregister(eventId: string, participantId: string) {
    await this.findOne(eventId);
    const now = new Date();

    // Check if event has started
    const firstSchedule = await this.prisma.eventSchedule.findFirst({
      where: { eventId },
      orderBy: { day: 'asc' },
    });

    if (firstSchedule && new Date(firstSchedule.day) <= now) {
      throw new ConflictException('Cannot unregister after event has started');
    }

    const registration = await this.prisma.eventParticipant.findUnique({
      where: { eventId_participantId: { eventId, participantId } },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.teamJoinRequest.deleteMany({
        where: {
          eventId,
          participantId,
          status: 'PENDING',
        },
      });

      return tx.eventParticipant.delete({
        where: { id: registration.id },
      });
    });
  }

  async getParticipants(eventId: string, query: PaginationDto) {
    await this.findOne(eventId);
    const { limit = 20, offset = 0 } = query;

    const [items, total] = await Promise.all([
      this.prisma.eventParticipant.findMany({
        where: { eventId },
        take: limit,
        skip: offset,
        include: {
          participant: {
            include: { college: true, department: true },
          },
          team: true,
        },
        orderBy: { registeredAt: 'desc' },
      }),
      this.prisma.eventParticipant.count({ where: { eventId } }),
    ]);

    return { items, total, limit, offset };
  }
}
