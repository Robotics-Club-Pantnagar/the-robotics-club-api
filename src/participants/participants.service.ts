import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { ClerkService } from '../clerk/clerk.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParticipantDto, UpdateParticipantDto } from './dto';

export interface ClerkProfileSyncPayload {
  name: string;
  email: string;
  username: string;
  imageUrl?: string;
}

interface ClerkManagedProfile {
  name: string;
  email: string;
  username: string;
  imageUrl: string;
}

@Injectable()
export class ParticipantsService {
  constructor(
    private prisma: PrismaService,
    private clerk: ClerkService,
    private config: ConfigService,
  ) {}

  async findByClerkId(clerkId: string) {
    return this.prisma.participant.findUnique({
      where: { id: clerkId },
      include: {
        college: true,
        department: true,
      },
    });
  }

  async existsByClerkId(clerkId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: clerkId },
      select: { id: true },
    });

    return {
      exists: Boolean(participant),
    };
  }

  async existsByClerkToken(rawToken: string) {
    const secretKey = this.config.get<string>('CLERK_USER_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('Server not configured for auth');
    }

    const token = rawToken.startsWith('Bearer ')
      ? rawToken.slice(7).trim()
      : rawToken.trim();

    try {
      const payload = await verifyToken(token, { secretKey });
      return this.existsByClerkId(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
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
    const existing = await this.prisma.participant.findUnique({
      where: { id: clerkId },
    });

    if (existing) {
      throw new ConflictException('Participant profile already exists');
    }

    await this.ensureCollegeDepartmentRelation(
      data.collegeId,
      data.departmentId,
    );
    const clerkProfile = await this.getClerkProfile(clerkId);

    return this.prisma.participant.create({
      data: {
        id: clerkId,
        name: clerkProfile.name,
        email: clerkProfile.email,
        username: clerkProfile.username,
        imageUrl: clerkProfile.imageUrl,
        phone: data.phone,
        collegeId: data.collegeId,
        departmentId: data.departmentId,
        collegeIdNo: data.collegeIdNo,
        year: data.year,
      },
      include: {
        college: true,
        department: true,
      },
    });
  }

  async update(id: string, data: UpdateParticipantDto) {
    const participant = await this.findOne(id);

    const nextCollegeId = data.collegeId ?? participant.collegeId;
    const nextDepartmentId = data.departmentId ?? participant.departmentId;
    if (
      nextCollegeId !== participant.collegeId ||
      nextDepartmentId !== participant.departmentId
    ) {
      await this.ensureCollegeDepartmentRelation(
        nextCollegeId,
        nextDepartmentId,
      );
    }

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

  async syncParticipantFromWebhook(
    clerkUserId: string,
    profile: ClerkProfileSyncPayload,
  ) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: clerkUserId },
      include: {
        college: true,
        department: true,
      },
    });

    if (!participant) {
      return null;
    }

    return this.prisma.participant.update({
      where: { id: clerkUserId },
      data: {
        name: profile.name,
        email: profile.email,
        username: profile.username,
        imageUrl: profile.imageUrl ?? participant.imageUrl,
      },
      include: {
        college: true,
        department: true,
      },
    });
  }

  private async getClerkProfile(clerkId: string): Promise<ClerkManagedProfile> {
    try {
      const clerkUser = await this.clerk.userClient.users.getUser(clerkId);

      const primaryEmail =
        clerkUser.emailAddresses.find(
          (emailAddress) => emailAddress.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!primaryEmail) {
        throw new BadRequestException('Primary email is missing in Clerk user');
      }

      const normalizedEmail = primaryEmail.toLowerCase();
      const username = this.normalizeUsername(
        clerkUser.username,
        normalizedEmail,
        clerkId,
      );
      const name = this.buildDisplayName(
        clerkUser.firstName,
        clerkUser.lastName,
        username,
        normalizedEmail,
      );

      if (!clerkUser.imageUrl) {
        throw new BadRequestException('Profile image is missing in Clerk user');
      }

      return {
        name,
        email: normalizedEmail,
        username,
        imageUrl: clerkUser.imageUrl,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Unable to fetch participant profile from Clerk',
      );
    }
  }

  private async ensureCollegeDepartmentRelation(
    collegeId: string,
    departmentId: string,
  ) {
    const [college, department] = await Promise.all([
      this.prisma.college.findUnique({ where: { id: collegeId } }),
      this.prisma.department.findUnique({ where: { id: departmentId } }),
    ]);

    if (!college) {
      throw new NotFoundException('College not found');
    }

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.collegeId !== college.id) {
      throw new BadRequestException(
        'Department does not belong to the specified college',
      );
    }
  }

  private normalizeUsername(
    rawUsername: string | null | undefined,
    email: string,
    userId: string,
  ): string {
    const source = rawUsername?.trim() || email.split('@')[0] || userId;
    const normalized = source
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (normalized.length > 0) {
      return normalized;
    }

    const fallbackSeed = userId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `user_${fallbackSeed.slice(-12) || 'participant'}`;
  }

  private buildDisplayName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    username: string,
    email: string,
  ): string {
    const nameParts = [firstName?.trim(), lastName?.trim()].filter(
      (part): part is string => Boolean(part && part.length > 0),
    );
    if (nameParts.length > 0) {
      return nameParts.join(' ');
    }

    return username || email.split('@')[0];
  }
}
