import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import {
  CONTENT_VIEW_VALUES,
  type ContentView,
} from '../../common/dto/content-view.dto';

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
