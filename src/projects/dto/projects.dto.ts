import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import {
  CONTENT_VIEW_VALUES,
  type ContentView,
} from '../../common/dto/content-view.dto';

export class FindProjectsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by project title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter by project slug' })
  @IsOptional()
  @IsString()
  slug?: string;

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

export class CreateProjectDto {
  @ApiProperty({ description: 'Project title', example: 'Autonomous Robot' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description: 'URL slug (auto-generated if not provided)',
    example: 'autonomous-robot',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiProperty({ description: 'Short project description' })
  @IsString()
  description!: string;

  @ApiProperty({
    description:
      'Rich content (Tiptap JSON document). Supports open-source nodes/marks (tables, tasks, highlight, underline, sub/sup, images, links, embedded videos). Raw file/video/audio nodes are rejected.',
    type: Object,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Built with ROS and OpenCV.' }],
        },
      ],
    },
  })
  @IsObject()
  content!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Project image URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'GitHub repository URL' })
  @IsOptional()
  @IsUrl()
  githubRepo?: string;

  @ApiPropertyOptional({ description: 'Demo/live URL' })
  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @ApiPropertyOptional({ description: 'Project tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Project title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Project slug' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Rich content (Tiptap JSON document). If provided, backend regenerates and sanitizes contentHtml automatically.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Project image URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'GitHub repository URL' })
  @IsOptional()
  @IsUrl()
  githubRepo?: string;

  @ApiPropertyOptional({ description: 'Demo/live URL' })
  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @ApiPropertyOptional({ description: 'Project tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class AddProjectMemberDto {
  @ApiProperty({ description: 'Member ID to add to project' })
  @IsString()
  memberId!: string;

  @ApiPropertyOptional({
    description: 'Role in project',
    example: 'Lead Developer',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
