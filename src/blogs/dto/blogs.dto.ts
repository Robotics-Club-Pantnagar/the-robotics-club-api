import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  IsBoolean,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export class FindBlogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by blog title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by author member ID' })
  @IsOptional()
  @IsString()
  authorId?: string;
}

export class CreateBlogDto {
  @ApiProperty({
    description: 'Blog title',
    example: 'Getting Started with Robotics',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description: 'URL slug (auto-generated if not provided)',
    example: 'getting-started-robotics',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiProperty({ description: 'Short excerpt/summary' })
  @IsString()
  excerpt!: string;

  @ApiProperty({ description: 'Rich content (Quill Delta JSON)', type: Object })
  @IsObject()
  content!: Record<string, unknown>;

  @ApiProperty({ description: 'HTML representation of content' })
  @IsString()
  contentHtml!: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Blog tags', type: [String] })
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

  @ApiPropertyOptional({ description: 'URL slug' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Short excerpt/summary' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Rich content (Quill Delta JSON)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'HTML representation of content' })
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Blog tags', type: [String] })
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
