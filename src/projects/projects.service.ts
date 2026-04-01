import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FindProjectsDto,
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
} from './dto';
import { PaginatedResponse } from '../common/dto';
import { Project, Prisma } from '../generated/prisma/client';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: FindProjectsDto): Promise<PaginatedResponse<Project>> {
    const { search, tags, memberId, limit = 20, offset = 0 } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (memberId) {
      where.members = { some: { memberId } };
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            include: { member: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            member: {
              include: { college: true, department: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(creatorId: string, data: CreateProjectDto) {
    // Sanitize HTML content
    const sanitizedHtml = this.sanitizeContent(data.contentHtml);

    const project = await this.prisma.project.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content as Prisma.InputJsonValue,
        contentHtml: sanitizedHtml,
        imageUrl: data.imageUrl,
        githubRepo: data.githubRepo,
        demoUrl: data.demoUrl,
        tags: data.tags || [],
        members: {
          create: {
            memberId: creatorId,
            role: 'Creator',
          },
        },
      },
      include: {
        members: { include: { member: true } },
      },
    });

    return project;
  }

  async update(id: string, requesterId: string, data: UpdateProjectDto) {
    await this.verifyProjectMembership(id, requesterId);

    const updateData: Record<string, unknown> = { ...data };
    if (data.contentHtml) {
      updateData.contentHtml = this.sanitizeContent(data.contentHtml);
    }

    return this.prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        members: { include: { member: true } },
      },
    });
  }

  async remove(id: string, requesterId: string, isAdmin: boolean) {
    if (!isAdmin) {
      await this.verifyProjectMembership(id, requesterId);
    }

    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }

  async addMember(
    projectId: string,
    requesterId: string,
    data: AddProjectMemberDto,
  ) {
    await this.verifyProjectMembership(projectId, requesterId);

    // Check if member exists
    const member = await this.prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        memberId: data.memberId,
        role: data.role,
      },
      include: { member: true, project: true },
    });
  }

  async removeMember(projectId: string, memberId: string, requesterId: string) {
    await this.verifyProjectMembership(projectId, requesterId);

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_memberId: { projectId, memberId } },
    });

    if (!membership) {
      throw new NotFoundException('Member not in project');
    }

    return this.prisma.projectMember.delete({
      where: { id: membership.id },
    });
  }

  private async verifyProjectMembership(projectId: string, memberId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_memberId: { projectId, memberId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }

    return true;
  }

  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img',
        'h1',
        'h2',
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height'],
        a: ['href', 'name', 'target', 'rel'],
        '*': ['class', 'id', 'style'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
  }
}
