import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParticipantDto, UpdateParticipantDto } from './dto';

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  async findByClerkId(clerkId: string) {
    return this.prisma.participant.findUnique({
      where: { id: clerkId },
      include: {
        college: true,
        department: true,
      },
    });
  }

  async findOne(id: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      include: {
        college: true,
        department: true,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return participant;
  }

  async create(clerkId: string, data: CreateParticipantDto) {
    return this.prisma.participant.create({
      data: {
        id: clerkId,
        ...data,
      },
      include: {
        college: true,
        department: true,
      },
    });
  }

  async update(id: string, data: UpdateParticipantDto) {
    await this.findOne(id);
    return this.prisma.participant.update({
      where: { id },
      data,
      include: {
        college: true,
        department: true,
      },
    });
  }

  async getRegisteredEvents(participantId: string) {
    await this.findOne(participantId);

    return this.prisma.eventParticipant.findMany({
      where: { participantId },
      include: {
        event: {
          include: {
            schedule: { orderBy: { day: 'asc' } },
          },
        },
        team: true,
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  async linkParticipantFromWebhook(email: string, clerkUserId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { email },
    });

    if (!participant) {
      return null;
    }

    if (participant.id === clerkUserId) {
      return participant;
    }

    return this.prisma.participant.update({
      where: { email },
      data: { id: clerkUserId },
    });
  }
}
