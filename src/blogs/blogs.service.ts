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

type UploadedImageFile = {
  buffer: Buffer;
};

type BlogResponse = Omit<Blog, 'content' | 'contentHtml'> &
  Partial<Pick<Blog, 'content' | 'contentHtml'>>;

@Injectable()
export class BlogsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
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

    const where: Record<string, unknown> = {
      published: true, // Only published blogs for public listing
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
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
            select: { id: true, name: true, username: true, imageUrl: true },
          },
        },
      }),
      this.prisma.blog.count({ where }),
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

  async findBySlug(slug: string, contentView?: ContentView) {
    const normalizedContentView = this.normalizeContentView(contentView);
    const blog = await this.prisma.blog.findFirst({
      where: { slug, published: true },
      include: {
        author: {
          include: { college: true, department: true },
        },
      },
    });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    // Increment view count
    await this.prisma.blog.update({
      where: { id: blog.id },
      data: { views: { increment: 1 } },
    });

    return this.applyContentView(blog, normalizedContentView);
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
          include: { college: true, department: true },
        },
      },
    });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!blog.published && !isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You do not have access to this blog');
    }

    return this.applyContentView(blog, normalizedContentView);
  }

  async create(authorId: string, data: CreateBlogDto) {
    const slug = await this.generateUniqueSlug(data.title);
    const sanitizedHtml = this.buildContentHtmlFromTiptap(data.content);

    return this.prisma.blog.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: data.content as Prisma.InputJsonValue,
        contentHtml: sanitizedHtml,
        coverImage: data.coverImage,
        tags: data.tags || [],
        published: data.published || false,
        publishedAt: data.published ? new Date() : null,
        authorId,
      },
      include: { author: true },
    });
  }

  async update(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    data: UpdateBlogDto,
  ) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You can only edit your own blogs');
    }

    const updateData: Record<string, unknown> = { ...data };

    if (data.content) {
      updateData.contentHtml = this.buildContentHtmlFromTiptap(data.content);
    }

    return this.prisma.blog.update({
      where: { id },
      data: updateData,
      include: { author: true },
    });
  }

  async remove(id: string, requesterId: string, isAdmin: boolean) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (!isAdmin && blog.authorId !== requesterId) {
      throw new ForbiddenException('You can only delete your own blogs');
    }

    return this.prisma.blog.delete({ where: { id } });
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

    return this.prisma.blog.update({
      where: { id },
      data: {
        published: data.published,
        publishedAt: data.published ? new Date() : null,
      },
      include: { author: true },
    });
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
