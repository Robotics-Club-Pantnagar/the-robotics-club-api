import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  JoinTeamRequestDto,
  ListJoinRequestsDto,
  ReviewJoinRequestAction,
  ReviewJoinRequestDto,
  TransferLeadershipDto,
} from './dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(creatorId: string, data: CreateTeamDto) {
    // Verify creator exists
    const creator = await this.prisma.participant.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new NotFoundException('Participant not found');
    }

    // Create team with creator as leader
    // Note: Team name uniqueness per event is enforced by DB trigger when registering for events
    const team = await this.prisma.team.create({
      data: {
        name: data.name,
        leaderId: creatorId,
      },
      include: {
        leader: {
          include: { college: true, department: true },
        },
      },
    });

    return team;
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        leader: {
          include: { college: true, department: true },
        },
        participants: {
          include: {
            participant: {
              include: { college: true, department: true },
            },
            event: true,
          },
        },
        events: {
          include: {
            event: true,
          },
        },
        joinRequests: {
          where: { status: 'PENDING' },
          include: {
            participant: {
              include: { college: true, department: true },
            },
            event: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Get unique participants across all event registrations
    const uniqueParticipants = new Map<
      string,
      (typeof team.participants)[number]['participant']
    >();
    team.participants.forEach((ep) => {
      if (!uniqueParticipants.has(ep.participantId)) {
        uniqueParticipants.set(ep.participantId, ep.participant);
      }
    });

    return {
      ...team,
      members: Array.from(uniqueParticipants.values()),
      registeredEvents: team.events.map((et) => et.event),
    };
  }

  async update(id: string, participantId: string, data: UpdateTeamDto) {
    const team = await this.prisma.team.findUnique({ where: { id } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Only team leader can update team name
    if (team.leaderId !== participantId) {
      throw new ForbiddenException('Only team leader can update team details');
    }

    // Team name update - DB trigger will check for conflicts across registered events
    return this.prisma.team.update({
      where: { id },
      data,
      include: {
        leader: true,
      },
    });
  }

  async remove(id: string, participantId: string, isAdmin: boolean = false) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    // Only admin or team leader can delete
    if (!isAdmin && team.leaderId !== participantId) {
      throw new ForbiddenException(
        'Only team leader or admin can delete the team',
      );
    }

    return this.prisma.team.delete({ where: { id } });
  }

  async transferLeadership(
    teamId: string,
    currentLeaderId: string,
    data: TransferLeadershipDto,
  ) {
    await this.assertTeamLeader(teamId, currentLeaderId);

    // Verify the new leader is a team member (has registered for at least one event with this team)
    const newLeaderMembership = await this.prisma.eventParticipant.findFirst({
      where: {
        teamId,
        participantId: data.newLeaderId,
      },
    });

    if (!newLeaderMembership && data.newLeaderId !== currentLeaderId) {
      throw new BadRequestException(
        'New leader must be an existing team member',
      );
    }

    // Verify the new leader participant exists
    const newLeader = await this.prisma.participant.findUnique({
      where: { id: data.newLeaderId },
    });

    if (!newLeader) {
      throw new NotFoundException('Participant not found');
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: { leaderId: data.newLeaderId },
      include: {
        leader: {
          include: { college: true, department: true },
        },
      },
    });
  }

  async requestJoin(
    teamId: string,
    requesterId: string,
    data: JoinTeamRequestDto,
  ) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: data.eventId },
      select: { id: true, hasTeam: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (!event.hasTeam) {
      throw new ConflictException('This event does not support team joining');
    }

    const registration = await this.prisma.eventParticipant.findUnique({
      where: {
        eventId_participantId: {
          eventId: data.eventId,
          participantId: requesterId,
        },
      },
    });
    if (!registration) {
      throw new ConflictException(
        'Register for the event as a solo participant before requesting a team',
      );
    }
    if (registration.teamId === teamId) {
      throw new ConflictException('You are already part of this team');
    }
    if (registration.teamId) {
      throw new ConflictException('You are already assigned to another team');
    }

    const eventTeam = await this.prisma.eventTeam.findUnique({
      where: {
        eventId_teamId: {
          eventId: data.eventId,
          teamId,
        },
      },
    });

    if (!eventTeam) {
      if (team.leaderId !== requesterId) {
        throw new ConflictException(
          'Team is not registered for this event yet. Ask the team leader to initialize team registration for this event.',
        );
      }

      await this.prisma.eventTeam.upsert({
        where: {
          eventId_teamId: {
            eventId: data.eventId,
            teamId,
          },
        },
        update: {},
        create: {
          eventId: data.eventId,
          teamId,
        },
      });
    }

    const activeRequest = await this.prisma.teamJoinRequest.findFirst({
      where: {
        eventId: data.eventId,
        participantId: requesterId,
        status: 'PENDING',
      },
    });
    if (activeRequest) {
      throw new ConflictException(
        'You already have a pending team join request for this event',
      );
    }

    const sameTeamRequest = await this.prisma.teamJoinRequest.findUnique({
      where: {
        eventId_teamId_participantId: {
          eventId: data.eventId,
          teamId,
          participantId: requesterId,
        },
      },
    });

    if (sameTeamRequest?.status === 'REJECTED') {
      throw new ConflictException(
        'Your request to this team was already rejected for this event',
      );
    }
    if (sameTeamRequest?.status === 'PENDING') {
      throw new ConflictException(
        'You already have a pending request for this team',
      );
    }

    const request = await this.prisma.teamJoinRequest.create({
      data: {
        eventId: data.eventId,
        teamId,
        participantId: requesterId,
        status: 'PENDING',
      },
      include: {
        event: true,
        participant: {
          include: { college: true, department: true },
        },
      },
    });

    return {
      message: 'Team join request submitted',
      request,
    };
  }

  async listJoinRequests(
    teamId: string,
    requesterId: string,
    query: ListJoinRequestsDto,
  ) {
    await this.assertTeamLeader(teamId, requesterId);

    return this.prisma.teamJoinRequest.findMany({
      where: {
        teamId,
        status: 'PENDING',
        ...(query.eventId && { eventId: query.eventId }),
      },
      include: {
        event: true,
        participant: {
          include: { college: true, department: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewJoinRequest(
    teamId: string,
    participantId: string,
    requesterId: string,
    data: ReviewJoinRequestDto,
  ) {
    await this.assertTeamLeader(teamId, requesterId);

    const joinRequest = await this.prisma.teamJoinRequest.findUnique({
      where: {
        eventId_teamId_participantId: {
          eventId: data.eventId,
          teamId,
          participantId,
        },
      },
      include: {
        event: true,
        participant: true,
      },
    });

    if (!joinRequest) {
      throw new NotFoundException('Join request not found');
    }

    if (!joinRequest.event.hasTeam) {
      throw new ConflictException('This event does not support team joining');
    }

    if (data.action === ReviewJoinRequestAction.REJECT) {
      const rejectedRequest =
        joinRequest.status === 'REJECTED'
          ? joinRequest
          : await this.prisma.teamJoinRequest.update({
              where: { id: joinRequest.id },
              data: { status: 'REJECTED' },
              include: {
                event: true,
                participant: true,
              },
            });

      return {
        message: 'Join request rejected',
        request: rejectedRequest,
      };
    }

    const registration = await this.prisma.$transaction(async (tx) => {
      const participantRegistration = await tx.eventParticipant.findUnique({
        where: {
          eventId_participantId: {
            eventId: data.eventId,
            participantId,
          },
        },
      });

      if (!participantRegistration) {
        throw new NotFoundException(
          'Participant is not registered for this event',
        );
      }

      if (
        participantRegistration.teamId &&
        participantRegistration.teamId !== teamId
      ) {
        throw new ConflictException(
          'Participant is already assigned to another team',
        );
      }

      if (
        joinRequest.event.maxTeamMembers &&
        participantRegistration.teamId !== teamId
      ) {
        const teamMemberCount = await tx.eventParticipant.count({
          where: {
            eventId: data.eventId,
            teamId,
          },
        });

        if (teamMemberCount >= joinRequest.event.maxTeamMembers) {
          throw new ConflictException(
            'Team has reached maximum members for this event',
          );
        }
      }

      const updatedRegistration =
        participantRegistration.teamId === teamId
          ? participantRegistration
          : await tx.eventParticipant.update({
              where: { id: participantRegistration.id },
              data: { teamId },
              include: {
                event: true,
                participant: true,
                team: true,
              },
            });

      await tx.teamJoinRequest.deleteMany({
        where: {
          eventId: data.eventId,
          participantId,
        },
      });

      return updatedRegistration;
    });

    return {
      message: 'Join request approved and participant assigned to team',
      registration,
    };
  }

  async removeMember(
    teamId: string,
    participantId: string,
    requesterId: string,
  ) {
    const team = await this.assertTeamLeader(teamId, requesterId);

    // Cannot remove the team leader
    if (participantId === team.leaderId) {
      throw new ConflictException(
        'Cannot remove team leader. Transfer leadership first or delete the team.',
      );
    }

    // Remove participant from all team event registrations
    const removed = await this.prisma.eventParticipant.updateMany({
      where: {
        teamId,
        participantId,
      },
      data: {
        teamId: null,
      },
    });

    if (removed.count === 0) {
      throw new NotFoundException('Member not found in team');
    }

    await this.prisma.teamJoinRequest.deleteMany({
      where: {
        teamId,
        participantId,
        status: 'PENDING',
      },
    });

    return { message: 'Member removed from team', removedCount: removed.count };
  }

  private async assertTeamLeader(teamId: string, participantId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.leaderId !== participantId) {
      throw new ForbiddenException(
        'Only the team leader can perform this action',
      );
    }

    return team;
  }
}
