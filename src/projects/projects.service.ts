import {
  BadRequestException,
  InternalServerErrorException,
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
import type { ContentView } from '../common/dto/content-view.dto';
import { Project, Prisma } from '../generated/prisma/client';
import sanitizeHtml from 'sanitize-html';
import { tiptapJsonToHtml } from '../utils/tiptap-content.util';
import { CloudinaryService } from '../cloudinary';

type UploadedImageFile = {
  buffer: Buffer;
};

type ProjectResponse = Omit<Project, 'content' | 'contentHtml'> &
  Partial<Pick<Project, 'content' | 'contentHtml'>>;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async findAll(
    query: FindProjectsDto,
  ): Promise<PaginatedResponse<ProjectResponse>> {
    const {
      search,
      tags,
      memberId,
      contentView,
      limit = 20,
      offset = 0,
    } = query;
    const normalizedContentView = this.normalizeContentView(contentView);

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

    return {
      items: items.map((item) =>
        this.applyContentView(item, normalizedContentView),
      ),
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string, contentView?: ContentView) {
    const normalizedContentView = this.normalizeContentView(contentView);
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

    return this.applyContentView(project, normalizedContentView);
  }

  async create(creatorId: string, data: CreateProjectDto) {
    const sanitizedHtml = this.buildContentHtmlFromTiptap(data.content);

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
    if (data.content) {
      updateData.contentHtml = this.buildContentHtmlFromTiptap(data.content);
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

  async uploadEditorImage(file: UploadedImageFile) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Image file is required');
    }

    try {
      const uploaded = await this.cloudinaryService.uploadImageBuffer(
        file.buffer,
        this.cloudinaryService.getEditorImagePath('projects'),
      );

      return {
        url: uploaded.secureUrl,
        secureUrl: uploaded.secureUrl,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        bytes: uploaded.bytes,
      };
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload image to Cloudinary',
      );
    }
  }

  private normalizeContentView(contentView?: ContentView): ContentView {
    return contentView || 'both';
  }

  private applyContentView<T extends { content: unknown; contentHtml: string }>(
    item: T,
    contentView: ContentView,
  ): Omit<T, 'content' | 'contentHtml'> &
    Partial<Pick<T, 'content' | 'contentHtml'>> {
    const { content, contentHtml, ...rest } = item;

    if (contentView === 'json') {
      return { ...rest, content };
    }

    if (contentView === 'html') {
      return { ...rest, contentHtml };
    }

    if (contentView === 'none') {
      return rest;
    }

    return { ...rest, content, contentHtml };
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
        'h3',
        'h4',
        'h5',
        'h6',
        'iframe',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'colgroup',
        'col',
        'figure',
        'figcaption',
        'mark',
        'u',
        'sub',
        'sup',
        'span',
        'hr',
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height', 'srcset', 'loading'],
        a: ['href', 'name', 'target', 'rel'],
        iframe: [
          'src',
          'width',
          'height',
          'frameborder',
          'allow',
          'allowfullscreen',
        ],
        table: ['class', 'style'],
        th: ['colspan', 'rowspan', 'style', 'data-colwidth'],
        td: ['colspan', 'rowspan', 'style', 'data-colwidth'],
        '*': ['class', 'id', 'style'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: {
        img: ['http', 'https'],
      },
      allowedIframeHostnames: [
        'www.youtube.com',
        'www.youtube-nocookie.com',
        'player.vimeo.com',
      ],
    });
  }

  private buildContentHtmlFromTiptap(content: Record<string, unknown>): string {
    try {
      const html = tiptapJsonToHtml(content);
      return this.sanitizeContent(html);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Invalid rich-text content. Provide a valid Tiptap JSON document.';

      throw new BadRequestException(message);
    }
  }
}
