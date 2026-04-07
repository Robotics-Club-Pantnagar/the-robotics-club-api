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
import slugify from 'slugify';
import { TagSearchIndexService } from '../cache/tag-search-index';
import { ValkeyCacheService } from '../cache/valkey-cache.service';
import { toUniqueTagSlugs } from '../utils/tag.util';

type UploadedImageFile = {
  buffer: Buffer;
};

type ProjectResponse = Omit<Project, 'content' | 'contentHtml'> &
  Partial<Pick<Project, 'content' | 'contentHtml'>> & {
    tags: string[];
  };

@Injectable()
export class ProjectsService {
  private readonly projectListCachePrefix = 'projects:list:';
  private readonly projectIdCachePrefix = 'projects:id:';
  private readonly projectSlugCachePrefix = 'projects:slug:';

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private cacheService: ValkeyCacheService,
    private tagSearchService: TagSearchIndexService,
  ) {}

  async findAll(
    query: FindProjectsDto,
  ): Promise<PaginatedResponse<ProjectResponse>> {
    const {
      search,
      tags,
      memberId,
      slug,
      contentView,
      limit = 20,
      offset = 0,
    } = query;
    const normalizedContentView = this.normalizeContentView(contentView);
    const normalizedTags = toUniqueTagSlugs(tags);
    const cacheKey = this.cacheService.buildKey('projects:list', {
      search: search ?? null,
      tags: normalizedTags,
      memberId: memberId ?? null,
      slug: slug ?? null,
      contentView: normalizedContentView,
      limit,
      offset,
    });

    const cached =
      await this.cacheService.getJson<PaginatedResponse<ProjectResponse>>(
        cacheKey,
      );
    if (cached) {
      return cached;
    }

    const where: Prisma.ProjectWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (normalizedTags.length > 0) {
      where.tags = {
        some: {
          tag: {
            tag: {
              in: normalizedTags,
            },
          },
        },
      };
    }

    if (memberId) {
      where.members = { some: { memberId } };
    }

    if (slug) {
      where.slug = slug;
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
          tags: {
            include: {
              tag: {
                select: {
                  tag: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const response: PaginatedResponse<ProjectResponse> = {
      items: items.map((item) =>
        this.toResponseWithTagSlugs(
          this.applyContentView(item, normalizedContentView),
        ),
      ),
      total,
      limit,
      offset,
    };

    await this.cacheService.setJson(cacheKey, response, 120);

    return response;
  }

  async findOne(id: string, contentView?: ContentView) {
    const normalizedContentView = this.normalizeContentView(contentView);
    const cacheKey = this.getProjectByIdCacheKey(id, normalizedContentView);
    const cached = await this.cacheService.getJson<ProjectResponse>(cacheKey);
    if (cached) {
      return cached;
    }

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
        tags: {
          include: {
            tag: {
              select: {
                tag: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const response = this.toResponseWithTagSlugs(
      this.applyContentView(project, normalizedContentView),
    );

    await this.cacheService.setJson(cacheKey, response, 180);

    return response;
  }

  async findBySlug(slug: string, contentView?: ContentView) {
    const normalizedContentView = this.normalizeContentView(contentView);
    const cacheKey = this.getProjectBySlugCacheKey(slug, normalizedContentView);
    const cached = await this.cacheService.getJson<ProjectResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            member: {
              include: { college: true, department: true },
            },
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                tag: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const response = this.toResponseWithTagSlugs(
      this.applyContentView(project, normalizedContentView),
    );

    await this.cacheService.setJson(cacheKey, response, 180);

    return response;
  }

  async create(creatorId: string, data: CreateProjectDto) {
    const sanitizedHtml = this.buildContentHtmlFromTiptap(data.content);
    const slug = await this.generateUniqueSlug(data.title);
    const normalizedTags = toUniqueTagSlugs(data.tags);

    const project = await this.prisma.project.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        content: data.content as Prisma.InputJsonValue,
        contentHtml: sanitizedHtml,
        imageUrl: data.imageUrl,
        githubRepo: data.githubRepo,
        demoUrl: data.demoUrl,
        ...(normalizedTags.length > 0
          ? {
              tags: {
                create: this.buildProjectTagCreateData(normalizedTags),
              },
            }
          : {}),
        members: {
          create: {
            memberId: creatorId,
            role: 'Creator',
          },
        },
      },
      include: {
        members: { include: { member: true } },
        tags: {
          include: {
            tag: {
              select: {
                tag: true,
              },
            },
          },
        },
      },
    });

    const createdCacheTarget = {
      id: String(project.id),
      slug: String(project.slug),
    };

    await this.invalidateProjectCaches(createdCacheTarget);
    await this.tagSearchService.onContentCreated(normalizedTags);

    return this.toResponseWithTagSlugs(project);
  }

  async update(id: string, requesterId: string, data: UpdateProjectDto) {
    await this.verifyProjectMembership(id, requesterId);

    const existingProject = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        tags: {
          select: {
            tag: {
              select: {
                tag: true,
              },
            },
          },
        },
      },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    const updateData: Prisma.ProjectUpdateInput = {};
    let addedTags: string[] = [];
    let removedTags: string[] = [];

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl;
    }

    if (data.githubRepo !== undefined) {
      updateData.githubRepo = data.githubRepo;
    }

    if (data.demoUrl !== undefined) {
      updateData.demoUrl = data.demoUrl;
    }

    if (data.tags !== undefined) {
      const normalizedTags = toUniqueTagSlugs(data.tags);
      const previousTags = this.extractTagSlugs(existingProject.tags);
      const previousTagSet = new Set(previousTags);
      const nextTagSet = new Set(normalizedTags);

      addedTags = normalizedTags.filter((tag) => !previousTagSet.has(tag));
      removedTags = previousTags.filter((tag) => !nextTagSet.has(tag));

      updateData.tags = {
        deleteMany: {},
        ...(normalizedTags.length > 0
          ? {
              create: this.buildProjectTagCreateData(normalizedTags),
            }
          : {}),
      };
    }

    if (data.content) {
      updateData.content = data.content as Prisma.InputJsonValue;
      updateData.contentHtml = this.buildContentHtmlFromTiptap(data.content);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        members: { include: { member: true } },
        tags: {
          include: {
            tag: {
              select: {
                tag: true,
              },
            },
          },
        },
      },
    });

    const existingCacheTarget = {
      id: String(existingProject.id),
      slug: String(existingProject.slug),
    };

    await this.invalidateProjectCaches(existingCacheTarget);

    if (addedTags.length > 0 || removedTags.length > 0) {
      await this.tagSearchService.onTagsReconciled(addedTags, removedTags);
    }

    return this.toResponseWithTagSlugs(updated);
  }

  async remove(id: string, requesterId: string, isAdmin: boolean) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        tags: {
          select: {
            tag: {
              select: {
                tag: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!isAdmin) {
      await this.verifyProjectMembership(id, requesterId);
    }

    const deleted = await this.prisma.project.delete({ where: { id } });

    await this.invalidateProjectCaches(project);
    await this.tagSearchService.onContentDeleted(
      this.extractTagSlugs(project.tags),
    );

    return deleted;
  }

  async updateBySlug(
    slug: string,
    requesterId: string,
    data: UpdateProjectDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.update(project.id, requesterId, data);
  }

  async removeBySlug(slug: string, requesterId: string, isAdmin: boolean) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.remove(project.id, requesterId, isAdmin);
  }

  async addMember(
    projectId: string,
    requesterId: string,
    data: AddProjectMemberDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, slug: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.verifyProjectMembership(projectId, requesterId);

    // Check if member exists
    const member = await this.prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const created = await this.prisma.projectMember.create({
      data: {
        projectId,
        memberId: data.memberId,
        role: data.role,
      },
      include: { member: true, project: true },
    });

    await this.invalidateProjectCaches(project);

    return created;
  }

  async removeMember(projectId: string, memberId: string, requesterId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, slug: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.verifyProjectMembership(projectId, requesterId);

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_memberId: { projectId, memberId } },
    });

    if (!membership) {
      throw new NotFoundException('Member not in project');
    }

    const deleted = await this.prisma.projectMember.delete({
      where: { id: membership.id },
    });

    await this.invalidateProjectCaches(project);

    return deleted;
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

  private getProjectByIdCacheKey(id: string, contentView: ContentView): string {
    return `${this.projectIdCachePrefix}${id}:${contentView}`;
  }

  private getProjectBySlugCacheKey(
    slug: string,
    contentView: ContentView,
  ): string {
    return `${this.projectSlugCachePrefix}${slug}:${contentView}`;
  }

  private async invalidateProjectCaches(project?: {
    id?: string;
    slug?: string;
  }): Promise<void> {
    const invalidations: Array<Promise<void>> = [
      this.cacheService.deleteByPrefix(this.projectListCachePrefix),
    ];

    if (project?.id) {
      invalidations.push(
        this.cacheService.deleteByPrefix(
          `${this.projectIdCachePrefix}${project.id}:`,
        ),
      );
    } else {
      invalidations.push(
        this.cacheService.deleteByPrefix(this.projectIdCachePrefix),
      );
    }

    if (project?.slug) {
      invalidations.push(
        this.cacheService.deleteByPrefix(
          `${this.projectSlugCachePrefix}${project.slug}:`,
        ),
      );
    } else {
      invalidations.push(
        this.cacheService.deleteByPrefix(this.projectSlugCachePrefix),
      );
    }

    await Promise.all(invalidations);
  }

  private buildProjectTagCreateData(tagSlugs: string[]) {
    return tagSlugs.map((tagSlug) => ({
      tag: {
        connectOrCreate: {
          where: { tag: tagSlug },
          create: { tag: tagSlug },
        },
      },
    }));
  }

  private extractTagSlugs(tags: Array<{ tag: { tag: string } }>): string[] {
    return tags.map(({ tag }) => tag.tag);
  }

  private toResponseWithTagSlugs<
    T extends { tags: Array<{ tag: { tag: string } }> },
  >(item: T): Omit<T, 'tags'> & { tags: string[] } {
    return {
      ...item,
      tags: item.tags.map(({ tag }) => tag.tag),
    };
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

  private async generateUniqueSlug(input: string): Promise<string> {
    const baseSlug = this.toSlug(input);
    let existing = await this.prisma.project.findUnique({
      where: { slug: baseSlug },
    });

    if (!existing) {
      return baseSlug;
    }

    let slug = `${baseSlug}-${Date.now()}`;
    let counter = 1;
    existing = await this.prisma.project.findUnique({ where: { slug } });

    while (existing) {
      slug = `${baseSlug}-${Date.now()}-${counter}`;
      counter += 1;
      existing = await this.prisma.project.findUnique({ where: { slug } });
    }

    return slug;
  }

  private toSlug(input: string): string {
    const slug = slugify(input, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    return slug || `project-${Date.now()}`;
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
