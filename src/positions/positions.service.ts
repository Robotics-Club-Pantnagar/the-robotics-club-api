import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePositionDto, UpdatePositionDto } from './dto';

type LatestMemberPositionPayload = {
  id: string;
  position: string;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
};

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  private withLatestPositionOnMember<
    T extends Record<string, unknown> & {
      positions?: LatestMemberPositionPayload[];
    },
  >(
    member: T,
  ): Omit<T, 'positions'> & {
    latestPosition?: LatestMemberPositionPayload;
  } {
    const { positions = [], ...rest } = member;
    const latestPosition = positions[0];

    return {
      ...rest,
      ...(latestPosition ? { latestPosition } : {}),
    };
  }

  private withMemberLatestPosition<
    T extends {
      member: Record<string, unknown> & {
        positions?: LatestMemberPositionPayload[];
      };
    },
  >(
    item: T,
  ): Omit<T, 'member'> & {
    member: Omit<T['member'], 'positions'> & {
      latestPosition?: LatestMemberPositionPayload;
    };
  } {
    return {
      ...item,
      member: this.withLatestPositionOnMember(item.member),
    };
  }

  async getPositionHistory(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return this.prisma.memberPosition.findMany({
      where: { memberId },
      orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
    });
  }

  async getCurrentLeadership() {
    // Returns positions where endYear IS NULL AND endMonth IS NULL (ongoing positions)
    const leadership = await this.prisma.memberPosition.findMany({
      where: {
        endYear: null,
        endMonth: null,
      },
      include: {
        member: {
          include: {
            college: true,
            department: true,
            positions: {
              select: {
                id: true,
                position: true,
                startMonth: true,
                startYear: true,
                endMonth: true,
                endYear: true,
              },
              orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    return leadership.map((item) => this.withMemberLatestPosition(item));
  }

  async getLeadershipByYear(year: number) {
    // Returns positions where startYear <= year AND (endYear IS NULL OR endYear >= year)
    const leadership = await this.prisma.memberPosition.findMany({
      where: {
        startYear: { lte: year },
        OR: [{ endYear: null }, { endYear: { gte: year } }],
      },
      include: {
        member: {
          include: {
            college: true,
            department: true,
            positions: {
              select: {
                id: true,
                position: true,
                startMonth: true,
                startYear: true,
                endMonth: true,
                endYear: true,
              },
              orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    return leadership.map((item) => this.withMemberLatestPosition(item));
  }

  async create(memberId: string, data: CreatePositionDto) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Check for overlap at application layer (DB trigger also enforces)
    await this.checkOverlap(memberId, data, null);

    const created = await this.prisma.memberPosition.create({
      data: {
        memberId,
        ...data,
      },
      include: {
        member: {
          include: {
            college: true,
            department: true,
            positions: {
              select: {
                id: true,
                position: true,
                startMonth: true,
                startYear: true,
                endMonth: true,
                endYear: true,
              },
              orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
              take: 1,
            },
          },
        },
      },
    });

    return this.withMemberLatestPosition(created);
  }

  async update(positionId: string, data: UpdatePositionDto) {
    const position = await this.prisma.memberPosition.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new NotFoundException('Position not found');
    }

    // Check for overlap (excluding current position)
    const mergedData = {
      startMonth: data.startMonth ?? position.startMonth,
      startYear: data.startYear ?? position.startYear,
      endMonth: data.endMonth ?? position.endMonth,
      endYear: data.endYear ?? position.endYear,
    };

    await this.checkOverlap(
      position.memberId,
      mergedData as CreatePositionDto,
      positionId,
    );

    const updated = await this.prisma.memberPosition.update({
      where: { id: positionId },
      data,
      include: {
        member: {
          include: {
            college: true,
            department: true,
            positions: {
              select: {
                id: true,
                position: true,
                startMonth: true,
                startYear: true,
                endMonth: true,
                endYear: true,
              },
              orderBy: [{ startYear: 'desc' }, { startMonth: 'desc' }],
              take: 1,
            },
          },
        },
      },
    });

    return this.withMemberLatestPosition(updated);
  }

  async remove(positionId: string) {
    const position = await this.prisma.memberPosition.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new NotFoundException('Position not found');
    }

    return this.prisma.memberPosition.delete({ where: { id: positionId } });
  }

  private async checkOverlap(
    memberId: string,
    data: CreatePositionDto,
    excludePositionId: string | null,
  ) {
    const existingPositions = await this.prisma.memberPosition.findMany({
      where: {
        memberId,
        ...(excludePositionId && { id: { not: excludePositionId } }),
      },
    });

    for (const existing of existingPositions) {
      if (this.intervalsOverlap(data, existing)) {
        throw new ConflictException(
          'Member already has a position during this time period',
        );
      }
    }
  }

  private intervalsOverlap(
    newPos: {
      startMonth: number;
      startYear: number;
      endMonth?: number | null;
      endYear?: number | null;
    },
    existing: {
      startMonth: number;
      startYear: number;
      endMonth: number | null;
      endYear: number | null;
    },
  ): boolean {
    // Convert to comparable format (year * 12 + month)
    const newStart = newPos.startYear * 12 + newPos.startMonth;
    const newEnd =
      newPos.endYear && newPos.endMonth
        ? newPos.endYear * 12 + newPos.endMonth
        : Infinity; // Ongoing position extends indefinitely

    const existingStart = existing.startYear * 12 + existing.startMonth;
    const existingEnd =
      existing.endYear && existing.endMonth
        ? existing.endYear * 12 + existing.endMonth
        : Infinity;

    // Intervals overlap if neither ends before the other starts
    return !(newEnd < existingStart || existingEnd < newStart);
  }
}
