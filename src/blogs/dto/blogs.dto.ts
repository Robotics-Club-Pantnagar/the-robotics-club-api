import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import { Position } from '../../generated/prisma/client';
import {
  CONTENT_VIEW_VALUES,
  type ContentView,
} from '../../common/dto/content-view.dto';
import { toStringArrayQuery } from '../../utils/query-array.util';

export class FindBlogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by blog title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by tag slugs (for example: ai, machine-learning). Supports repeated query keys or a single key.',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => toStringArrayQuery(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by author member ID' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description:
      'Controls rich content fields in response. both=content+contentHtml, html=only contentHtml, json=only content, none=exclude both.',
    enum: CONTENT_VIEW_VALUES,
    default: 'html',
  })
  @IsOptional()
  @IsIn([...CONTENT_VIEW_VALUES])
  contentView?: ContentView = 'html';
}

export class CreateBlogDto {
  @ApiProperty({
    description: 'Blog title',
    example: 'Getting Started with Robotics',
  })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Short excerpt/summary' })
  @IsString()
  excerpt!: string;

  @ApiProperty({
    description:
      'Rich content (Tiptap JSON document). Supports open-source nodes/marks (tables, tasks, highlight, underline, sub/sup, images, links, embedded videos). Raw file/video/audio nodes are rejected.',
    type: Object,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Getting started with robotics.' }],
        },
      ],
    },
  })
  @IsObject()
  content!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({
    description:
      'Blog tags (free-form labels). Backend slugifies and normalizes these into shared tags.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Publish immediately', default: false })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateBlogDto {
  @ApiPropertyOptional({ description: 'Blog title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Short excerpt/summary' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description:
      'Rich content (Tiptap JSON document). If provided, backend regenerates and sanitizes contentHtml automatically.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({
    description:
      'Blog tags (free-form labels). Backend slugifies and normalizes these into shared tags.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class PublishBlogDto {
  @ApiProperty({
    description: 'Publish status (true=publish, false=unpublish)',
  })
  @IsBoolean()
  published!: boolean;
}

export class BlogAuthorLatestPositionDto {
  @ApiProperty({ description: 'Position record ID' })
  id!: string;

  @ApiProperty({ description: 'Position title', enum: Position })
  position!: Position;

  @ApiProperty({ description: 'Start month (1-12)' })
  startMonth!: number;

  @ApiProperty({ description: 'Start year' })
  startYear!: number;

  @ApiPropertyOptional({ description: 'End month (1-12, null for ongoing)' })
  endMonth?: number;

  @ApiPropertyOptional({ description: 'End year (null for ongoing)' })
  endYear?: number;
}

export class BlogAuthorCollegeDto {
  @ApiProperty({ description: 'College ID' })
  id!: string;

  @ApiProperty({ description: 'College name' })
  name!: string;

  @ApiProperty({ description: 'College code' })
  code!: string;

  @ApiPropertyOptional({ description: 'College location' })
  location?: string;
}

export class BlogAuthorDepartmentDto {
  @ApiProperty({ description: 'Department ID' })
  id!: string;

  @ApiProperty({ description: 'Department name' })
  name!: string;

  @ApiProperty({ description: 'Department code' })
  code!: string;

  @ApiProperty({ description: 'College ID this department belongs to' })
  collegeId!: string;
}

export class BlogAuthorDto {
  @ApiProperty({ description: 'Member ID' })
  id!: string;

  @ApiProperty({ description: 'Member name' })
  name!: string;

  @ApiProperty({ description: 'Member username' })
  username!: string;

  @ApiProperty({ description: 'Profile image URL' })
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'College ID' })
  collegeId?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  departmentId?: string;

  @ApiPropertyOptional({ type: BlogAuthorCollegeDto })
  college?: BlogAuthorCollegeDto;

  @ApiPropertyOptional({ type: BlogAuthorDepartmentDto })
  department?: BlogAuthorDepartmentDto;

  @ApiPropertyOptional({
    type: BlogAuthorLatestPositionDto,
    description: 'Latest known member position for lightweight display',
  })
  latestPosition?: BlogAuthorLatestPositionDto;
}

export class BlogDataDto {
  @ApiProperty({ description: 'Blog ID' })
  id!: string;

  @ApiProperty({ description: 'Blog title' })
  title!: string;

  @ApiProperty({ description: 'Blog slug' })
  slug!: string;

  @ApiProperty({ description: 'Blog excerpt' })
  excerpt!: string;

  @ApiPropertyOptional({ description: 'Rich content (Tiptap JSON)' })
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Sanitized HTML content' })
  contentHtml?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  coverImage?: string;

  @ApiProperty({ description: 'Author member ID' })
  authorId!: string;

  @ApiProperty({ type: BlogAuthorDto })
  author!: BlogAuthorDto;

  @ApiProperty({ type: [String], description: 'Normalized tag slugs' })
  tags!: string[];

  @ApiProperty({ description: 'Publish state' })
  published!: boolean;

  @ApiPropertyOptional({ description: 'Published timestamp' })
  publishedAt?: string;

  @ApiProperty({ description: 'View count' })
  views!: number;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: string;
}

export class BlogsListDataDto {
  @ApiProperty({ type: [BlogDataDto] })
  items!: BlogDataDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class BlogEditorImageUploadDto {
  @ApiProperty({ description: 'Image URL' })
  url!: string;

  @ApiProperty({ description: 'Secure Cloudinary URL' })
  secureUrl!: string;

  @ApiProperty({ description: 'Cloudinary public ID' })
  publicId!: string;

  @ApiProperty({ description: 'Image width in pixels' })
  width!: number;

  @ApiProperty({ description: 'Image height in pixels' })
  height!: number;

  @ApiProperty({ description: 'Image format' })
  format!: string;

  @ApiProperty({ description: 'Image size in bytes' })
  bytes!: number;
}
