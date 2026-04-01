import {
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
import { Blog, Prisma } from '../generated/prisma/client';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';

@Injectable()
export class BlogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: FindBlogsDto): Promise<PaginatedResponse<Blog>> {
    const { search, tags, authorId, limit = 20, offset = 0 } = query;

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

    return { items, total, limit, offset };
  }

  async findBySlug(slug: string) {
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

    return blog;
  }

  async findOne(id: string, requesterId: string, isAdmin: boolean) {
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

    return blog;
  }

  async create(authorId: string, data: CreateBlogDto) {
    const slug = data.slug || (await this.generateUniqueSlug(data.title));
    const sanitizedHtml = this.sanitizeContent(data.contentHtml);

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

    if (data.contentHtml) {
      updateData.contentHtml = this.sanitizeContent(data.contentHtml);
    }

    if (data.slug && data.slug !== blog.slug) {
      // Verify new slug is unique
      const existing = await this.prisma.blog.findUnique({
        where: { slug: data.slug },
      });
      if (existing && existing.id !== id) {
        // Append random suffix to make it unique
        updateData.slug = `${data.slug}-${Date.now()}`;
      }
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

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = slugify(title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    // Check if slug exists
    let slug = baseSlug;
    let counter = 1;
    let existing = await this.prisma.blog.findUnique({ where: { slug } });

    while (existing) {
      slug = `${baseSlug}-${counter}`;
      existing = await this.prisma.blog.findUnique({ where: { slug } });
      counter++;
    }

    return slug;
  }

  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img',
        'h1',
        'h2',
        'iframe',
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height'],
        a: ['href', 'name', 'target', 'rel'],
        iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
        '*': ['class', 'id', 'style'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
    });
  }
}
