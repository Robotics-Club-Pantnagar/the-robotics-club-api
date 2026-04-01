import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        college: true,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async create(data: CreateDepartmentDto) {
    // Verify college exists
    const college = await this.prisma.college.findUnique({
      where: { id: data.collegeId },
    });

    if (!college) {
      throw new NotFoundException('College not found');
    }

    return this.prisma.department.create({
      data,
      include: { college: true },
    });
  }

  async update(id: string, data: UpdateDepartmentDto) {
    await this.findOne(id);
    return this.prisma.department.update({
      where: { id },
      data,
      include: { college: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.department.delete({
      where: { id },
    });
  }
}
