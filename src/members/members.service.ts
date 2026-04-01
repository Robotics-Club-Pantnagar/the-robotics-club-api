import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkService } from '../clerk/clerk.service';
import { FindMembersDto, InviteMemberDto, UpdateMemberDto } from './dto';
import { PaginatedResponse } from '../common/dto';
import { Member } from '../generated/prisma/client';

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
      // Invited-but-unaccepted users use Clerk invitation IDs (inv_*).
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
    // Check if member already exists
    const existing = await this.prisma.member.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Member with this email or username already exists',
      );
    }

    // Verify college and department exist
    const [college, department] = await Promise.all([
      this.prisma.college.findUnique({ where: { id: data.collegeId } }),
      this.prisma.department.findUnique({ where: { id: data.departmentId } }),
    ]);

    if (!college) throw new NotFoundException('College not found');
    if (!department) throw new NotFoundException('Department not found');

    // Send Clerk invitation
    let invitationId: string;
    try {
      const invitation =
        await this.clerk.teamClient.invitations.createInvitation({
          emailAddress: data.email,
          publicMetadata: {
            role: 'member',
            collegeId: data.collegeId,
            departmentId: data.departmentId,
          },
          redirectUrl: process.env.CLERK_MEMBER_REDIRECT_URL,
        });
      invitationId = invitation.id;
    } catch (error) {
      console.error('Failed to send Clerk invitation:', error);
      throw new InternalServerErrorException('Failed to send invitation email');
    }

    // Create member record with pending status
    const member = await this.prisma.member.create({
      data: {
        id: invitationId,
        ...data,
      },
      include: {
        college: true,
        department: true,
      },
    });

    return {
      ...member,
      message:
        'Invitation sent successfully. Member will be activated upon accepting the Clerk invitation.',
    };
  }

  async linkMemberFromWebhook(email: string, clerkUserId: string) {
    const member = await this.prisma.member.findUnique({
      where: { email },
    });

    if (!member) {
      return null; // Member not found, webhook might be for a different user type
    }

    if (member.id === clerkUserId) {
      return member;
    }

    return this.prisma.member.update({
      where: { email },
      data: {
        id: clerkUserId,
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
}
