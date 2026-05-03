import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FindBlogsDto,
  CreateBlogDto,
  UpdateBlogDto,
  PublishBlogDto,
} from './dto';
import { PaginatedResponse } from '../common/dto';
import type { ContentView } from '../common/dto/content-view.dto';
import { Blog, Prisma } from '../generated/prisma/client';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';
import { tiptapJsonToHtml } from '../utils/tiptap-content.util';
import { CloudinaryService } from '../cloudinary';
import { CacheService } from '../cache/cache.service';
import { TagSearchIndexService } from '../cache/tag-search-index';
import { toUniqueTagSlugs } from '../utils/tag.util';

type UploadedImageFile = {
  buffer: Buffer;
};

type LatestMemberPositionPayload = {
  id: string;
  position: string;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
};

type BlogResponse = Omit<Blog, 'content' | 'contentHtml'> &
  Partial<Pick<Blog, 'content' | 'contentHtml'>> & {
    tags: string[];
  };

@Injectable()
export class BlogsService {
  private readonly blogListCachePrefix = 'blogs:list:';
  private readonly blogSlugCachePrefix = 'blogs:slug:';

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private cacheService: CacheService,
    private tagSearchService: TagSearchIndexService,
  ) {}

  async findAll(query: FindBlogsDto): Promise<PaginatedResponse<BlogResponse>> {
    const {
      search,
      tags,
      authorId,
      contentView,
      limit = 20,
      offset = 0,
    } = query;
    const normalizedContentView = this.normalizeContentView(contentView);
    const normalizedTags = toUniqueTagSlugs(tags);
    const cacheKey = this.cacheService.buildKey('blogs:list', {
      search: search ?? null,
      tags: normalizedTags,
      authorId: authorId ?? null,
      contentView: normalizedContentView,
      limit,
      offset,
    });

    const cached =
      await this.cacheService.getJson<PaginatedResponse<BlogResponse>>(
        cacheKey,
      );
    if (cached) {
      return cached;
    }

    const where: Prisma.BlogWhereInput = {
      published: true, // Only published blogs for public listing
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
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

    if (authorId) {
      where.authorId = authorId;
    }

    const [items, total] = await Promise.all([
      this.prisma.blog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { publishedAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              imageUrl: true,
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
      this.prisma.blog.count({ where }),
    ]);

    const response: PaginatedResponse<BlogResponse> = {
      items: items.map((item) =>
        this.toResponseWithTagSlugs(
          this.applyContentView(
            this.withAuthorLatestPosition(item),
            normalizedContentView,
          ),
        ),
      ),
      total,
      limit,
      offset,
    };

    await this.cacheService.setJson(cacheKey, response, 120);

    return response;
  }

  async findBySlug(slug: string, contentView?: ContentView) {
    const normalizedContentView = this.normalizeContentView(contentView);
    const cacheKey = this.getBlogBySlugCacheKey(slug, normalizedContentView);

    const cached = await this.cacheService.getJson<BlogResponse>(cacheKey);
    if (cached) {
      await this.incrementViewCount(cached.id);
      return cached;
    }

    const blog = await this.prisma.blog.findFirst({
      where: { slug, published: true },
      include: {
        author: {
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

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    await this.incrementViewCount(blog.id);

    const response = this.toResponseWithTagSlugs(
      this.applyContentView(
        this.withAuthorLatestPosition({ ...blog, views: blog.views + 1 }),
        normalizedContentView,
      ),
    );

    await this.cacheService.setJson(cacheKey, response, 90);

    return response;
  }

  async findOne(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    contentView?: ContentView,
  ) {
    const normalizedContentView = this.normalizeContentView(contentView);
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        author: {
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

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!blog.published && !isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You do not have access to this blog');
    }

    return this.toResponseWithTagSlugs(
      this.applyContentView(
        this.withAuthorLatestPosition(blog),
        normalizedContentView,
      ),
    );
  }

  async create(authorId: string, data: CreateBlogDto) {
    const slug = await this.generateUniqueSlug(data.title);
    const sanitizedHtml = this.buildContentHtmlFromTiptap(data.content);
    const normalizedTags = toUniqueTagSlugs(data.tags);

    const created = await this.prisma.blog.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: data.content as Prisma.InputJsonValue,
        contentHtml: sanitizedHtml,
        coverImage: data.coverImage,
        ...(normalizedTags.length > 0
          ? {
              tags: {
                create: this.buildBlogTagCreateData(normalizedTags),
              },
            }
          : {}),
        published: data.published || false,
        publishedAt: data.published ? new Date() : null,
        authorId,
      },
      include: {
        author: {
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

    await this.invalidateBlogCaches(slug);
    await this.tagSearchService.onContentCreated(normalizedTags);

    return this.toResponseWithTagSlugs(this.withAuthorLatestPosition(created));
  }

  async update(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    data: UpdateBlogDto,
  ) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
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

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You can only edit your own blogs');
    }

    const updateData: Prisma.BlogUpdateInput = {};
    let addedTags: string[] = [];
    let removedTags: string[] = [];

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.excerpt !== undefined) {
      updateData.excerpt = data.excerpt;
    }

    if (data.coverImage !== undefined) {
      updateData.coverImage = data.coverImage;
    }

    if (data.tags !== undefined) {
      const normalizedTags = toUniqueTagSlugs(data.tags);
      const previousTags = this.extractTagSlugs(blog.tags);
      const previousTagSet = new Set(previousTags);
      const nextTagSet = new Set(normalizedTags);

      addedTags = normalizedTags.filter((tag) => !previousTagSet.has(tag));
      removedTags = previousTags.filter((tag) => !nextTagSet.has(tag));

      updateData.tags = {
        deleteMany: {},
        ...(normalizedTags.length > 0
          ? {
              create: this.buildBlogTagCreateData(normalizedTags),
            }
          : {}),
      };
    }

    if (data.content) {
      updateData.content = data.content as Prisma.InputJsonValue;
      updateData.contentHtml = this.buildContentHtmlFromTiptap(data.content);
    }

    const updated = await this.prisma.blog.update({
      where: { id },
      data: updateData,
      include: {
        author: {
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

    await this.invalidateBlogCaches(blog.slug);

    if (addedTags.length > 0 || removedTags.length > 0) {
      await this.tagSearchService.onTagsReconciled(addedTags, removedTags);
    }

    return this.toResponseWithTagSlugs(this.withAuthorLatestPosition(updated));
  }

  async remove(id: string, requesterId: string, isAdmin: boolean) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
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

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You can only delete your own blogs');
    }

    const deleted = await this.prisma.blog.delete({ where: { id } });

    await this.invalidateBlogCaches(blog.slug);
    await this.tagSearchService.onContentDeleted(
      this.extractTagSlugs(blog.tags),
    );

    return deleted;
  }

  async publish(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    data: PublishBlogDto,
  ) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You can only publish your own blogs');
    }

    const updated = await this.prisma.blog.update({
      where: { id },
      data: {
        published: data.published,
        publishedAt: data.published ? new Date() : null,
      },
      include: {
        author: {
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

    await this.invalidateBlogCaches(blog.slug);

    return this.toResponseWithTagSlugs(this.withAuthorLatestPosition(updated));
  }

  async uploadEditorImage(file: UploadedImageFile) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Image file is required');
    }

    try {
      const uploaded = await this.cloudinaryService.uploadImageBuffer(
        file.buffer,
        this.cloudinaryService.getEditorImagePath('blogs'),
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

  private getBlogBySlugCacheKey(
    slug: string,
    contentView: ContentView,
  ): string {
    return `${this.blogSlugCachePrefix}${slug}:${contentView}`;
  }

  private async invalidateBlogCaches(slug?: string): Promise<void> {
    await this.cacheService.deleteByPrefix(this.blogListCachePrefix);

    if (slug) {
      await this.cacheService.deleteByPrefix(
        `${this.blogSlugCachePrefix}${slug}:`,
      );
      return;
    }

    await this.cacheService.deleteByPrefix(this.blogSlugCachePrefix);
  }

  private async incrementViewCount(blogId: string): Promise<void> {
    try {
      await this.prisma.blog.update({
        where: { id: blogId },
        data: { views: { increment: 1 } },
      });
    } catch {
      // Read path should still succeed even if view counter update fails.
    }
  }

  private buildBlogTagCreateData(tagSlugs: string[]) {
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

  private withAuthorLatestPosition<
    T extends {
      author: Record<string, unknown> & {
        positions?: LatestMemberPositionPayload[];
      };
    },
  >(
    item: T,
  ): Omit<T, 'author'> & {
    author: Omit<T['author'], 'positions'> & {
      latestPosition?: LatestMemberPositionPayload;
    };
  } {
    return {
      ...item,
      author: this.withLatestPositionOnMember(item.author),
    };
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

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = this.toSlug(title);
    let existing = await this.prisma.blog.findUnique({
      where: { slug: baseSlug },
    });

    if (!existing) {
      return baseSlug;
    }

    let slug = `${baseSlug}-${Date.now()}`;
    let counter = 1;
    existing = await this.prisma.blog.findUnique({ where: { slug } });

    while (existing) {
      slug = `${baseSlug}-${Date.now()}-${counter}`;
      counter += 1;
      existing = await this.prisma.blog.findUnique({ where: { slug } });
    }

    return slug;
  }

  private toSlug(input: string): string {
    const slug = slugify(input, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    return slug || `blog-${Date.now()}`;
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
