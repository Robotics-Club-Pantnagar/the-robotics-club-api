import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCollegeDto,
  UpdateCollegeDto,
  FindCollegesDto,
} from './dto/colleges.dto';
import { PaginatedResponse } from '../common/dto';
import { College } from '../generated/prisma/client';

@Injectable()
export class CollegesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: FindCollegesDto): Promise<PaginatedResponse<College>> {
    const { search, limit = 20, offset = 0 } = query;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.college.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
      }),
      this.prisma.college.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: string) {
    const college = await this.prisma.college.findUnique({
      where: { id },
      include: {
        departments: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!college) {
      throw new NotFoundException('College not found');
    }

    return {
      ...college,
      memberCount: college._count.members,
      _count: undefined,
    };
  }

  async create(data: CreateCollegeDto) {
    return this.prisma.college.create({
      data,
    });
  }

  async update(id: string, data: UpdateCollegeDto) {
    await this.findOne(id);
    return this.prisma.college.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.college.delete({
      where: { id },
    });
  }

  async findDepartments(collegeId: string) {
    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
    });

    if (!college) {
      throw new NotFoundException('College not found');
    }

    return this.prisma.department.findMany({
      where: { collegeId },
      orderBy: { name: 'asc' },
    });
  }
}
