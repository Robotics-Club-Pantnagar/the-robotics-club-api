import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkService } from '../clerk/clerk.service';
import { FindMembersDto, InviteMemberDto, UpdateMemberDto } from './dto';
import { PaginatedResponse } from '../common/dto';
import { Member } from '../generated/prisma/client';

export interface MemberClerkProfileSyncPayload {
  name: string;
  email: string;
  username: string;
  imageUrl?: string;
}

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private clerk: ClerkService,
  ) {}

  async findAll(query: FindMembersDto): Promise<PaginatedResponse<Member>> {
    const {
      search,
      position,
      collegeId,
      departmentId,
      graduationYear,
      limit = 20,
      offset = 0,
    } = query;

    const where: Record<string, unknown> = {
      // Hide invited-but-unaccepted rows created with invitation IDs.
      NOT: { id: { startsWith: 'inv_' } },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (position) {
      where.positions = {
        some: {
          position,
          OR: [
            { endYear: null },
            { endYear: { gte: new Date().getFullYear() } },
          ],
        },
      };
    }

    if (collegeId) where.collegeId = collegeId;
    if (departmentId) where.departmentId = departmentId;
    if (graduationYear) where.graduationYear = graduationYear;

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
        include: {
          college: true,
          department: true,
          positions: {
            where: {
              OR: [
                { endYear: null },
                { endYear: { gte: new Date().getFullYear() } },
              ],
            },
            orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
          },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        college: true,
        department: true,
        positions: {
          orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
        },
        projects: {
          include: {
            project: true,
          },
        },
        blogs: {
          where: { published: true },
          orderBy: { publishedAt: 'desc' },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async findByClerkId(clerkId: string) {
    return this.prisma.member.findFirst({
      where: {
        // We'll need to store clerkId somewhere - for now use email lookup
        // or modify schema to include clerkId
        id: clerkId,
      },
      include: {
        college: true,
        department: true,
        positions: true,
      },
    });
  }

  async invite(data: InviteMemberDto) {
    const normalizedEmail = data.email.toLowerCase();
    const existing = await this.prisma.member.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: data.username },
          { collegeIdNo: data.collegeIdNo },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Member with this email, username, or college ID number already exists',
      );
    }

    await this.ensureCollegeDepartmentRelation(
      data.collegeId,
      data.departmentId,
    );

    let invitation: { id: string };
    try {
      invitation = await this.clerk.teamClient.invitations.createInvitation({
        emailAddress: normalizedEmail,
        publicMetadata: {
          role: 'member',
        },
        redirectUrl: process.env.CLERK_MEMBER_REDIRECT_URL,
      });
    } catch (error) {
      console.error('Failed to send Clerk invitation:', error);
      throw new InternalServerErrorException('Failed to send invitation email');
    }

    const member = await this.prisma.member.create({
      data: {
        id: invitation.id,
        name: data.name,
        email: normalizedEmail,
        username: data.username,
        imageUrl: data.imageUrl,
        collegeId: data.collegeId,
        departmentId: data.departmentId,
        collegeIdNo: data.collegeIdNo,
        graduationYear: data.graduationYear,
      },
      include: {
        college: true,
        department: true,
      },
    });

    return {
      ...member,
      message:
        'Invitation sent successfully. Member profile is in pending state until invitation acceptance.',
    };
  }

  async createFromWebhook(
    clerkUserId: string,
    profile: MemberClerkProfileSyncPayload,
  ) {
    const normalizedEmail = profile.email.toLowerCase();

    const existingById = await this.prisma.member.findUnique({
      where: { id: clerkUserId },
      include: {
        college: true,
        department: true,
      },
    });

    if (existingById) {
      return this.prisma.member.update({
        where: { id: clerkUserId },
        data: {
          name: profile.name,
          email: normalizedEmail,
          username: profile.username,
          imageUrl: profile.imageUrl ?? existingById.imageUrl,
          invitationAccepted: true,
          acceptedAt: existingById.acceptedAt ?? new Date(),
        },
        include: {
          college: true,
          department: true,
        },
      });
    }

    const existingByEmail = await this.prisma.member.findUnique({
      where: { email: normalizedEmail },
      include: {
        college: true,
        department: true,
      },
    });

    if (!existingByEmail) {
      return null;
    }

    if (
      existingByEmail.id !== clerkUserId &&
      !existingByEmail.id.startsWith('inv_')
    ) {
      return null;
    }

    return this.prisma.member.update({
      where: { id: existingByEmail.id },
      data: {
        ...(existingByEmail.id.startsWith('inv_') &&
        existingByEmail.id !== clerkUserId
          ? { id: clerkUserId }
          : {}),
        name: profile.name,
        email: normalizedEmail,
        username: profile.username,
        imageUrl: profile.imageUrl ?? existingByEmail.imageUrl,
        invitationAccepted: true,
        acceptedAt: existingByEmail.acceptedAt ?? new Date(),
      },
      include: {
        college: true,
        department: true,
      },
    });
  }

  async syncMemberFromWebhook(
    clerkUserId: string,
    profile: MemberClerkProfileSyncPayload,
  ) {
    const normalizedEmail = profile.email.toLowerCase();
    const member = await this.prisma.member.findUnique({
      where: { id: clerkUserId },
      include: {
        college: true,
        department: true,
      },
    });

    if (!member) {
      return null;
    }

    return this.prisma.member.update({
      where: { id: clerkUserId },
      data: {
        name: profile.name,
        email: normalizedEmail,
        username: profile.username,
        imageUrl: profile.imageUrl ?? member.imageUrl,
      },
      include: {
        college: true,
        department: true,
      },
    });
  }

  async update(
    id: string,
    data: UpdateMemberDto,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const member = await this.findOne(id);

    // Only self or admin can update
    if (!isAdmin && member.id !== requesterId) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const nextCollegeId = data.collegeId ?? member.collegeId;
    const nextDepartmentId = data.departmentId ?? member.departmentId;
    if (
      nextCollegeId !== member.collegeId ||
      nextDepartmentId !== member.departmentId
    ) {
      await this.ensureCollegeDepartmentRelation(
        nextCollegeId,
        nextDepartmentId,
      );
    }

    return this.prisma.member.update({
      where: { id },
      data,
      include: {
        college: true,
        department: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.member.delete({ where: { id } });
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
}
