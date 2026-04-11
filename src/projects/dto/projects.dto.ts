import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
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

export class FindProjectsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by project title' })
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

  @ApiPropertyOptional({
    description:
      'Project tags (free-form labels). Backend slugifies and normalizes these into shared tags.',
    type: [String],
  })
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

  @ApiPropertyOptional({
    description:
      'Project tags (free-form labels). Backend slugifies and normalizes these into shared tags.',
    type: [String],
  })
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

export class ProjectMemberLatestPositionDto {
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

export class ProjectMemberCollegeDto {
  @ApiProperty({ description: 'College ID' })
  id!: string;

  @ApiProperty({ description: 'College name' })
  name!: string;

  @ApiProperty({ description: 'College code' })
  code!: string;

  @ApiPropertyOptional({ description: 'College location' })
  location?: string;
}

export class ProjectMemberDepartmentDto {
  @ApiProperty({ description: 'Department ID' })
  id!: string;

  @ApiProperty({ description: 'Department name' })
  name!: string;

  @ApiProperty({ description: 'Department code' })
  code!: string;

  @ApiProperty({ description: 'College ID this department belongs to' })
  collegeId!: string;
}

export class ProjectMemberProfileDto {
  @ApiProperty({ description: 'Member ID' })
  id!: string;

  @ApiProperty({ description: 'Member name' })
  name!: string;

  @ApiProperty({ description: 'Member username' })
  username!: string;

  @ApiProperty({ description: 'Profile image URL' })
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Member email' })
  email?: string;

  @ApiPropertyOptional({ description: 'College ID' })
  collegeId?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  departmentId?: string;

  @ApiPropertyOptional({ type: ProjectMemberCollegeDto })
  college?: ProjectMemberCollegeDto;

  @ApiPropertyOptional({ type: ProjectMemberDepartmentDto })
  department?: ProjectMemberDepartmentDto;

  @ApiPropertyOptional({
    type: ProjectMemberLatestPositionDto,
    description: 'Latest known member position for display on first fetch',
  })
  latestPosition?: ProjectMemberLatestPositionDto;
}

export class ProjectMemberDataDto {
  @ApiProperty({ description: 'Project membership ID' })
  id!: string;

  @ApiProperty({ description: 'Project ID' })
  projectId!: string;

  @ApiProperty({ description: 'Member ID' })
  memberId!: string;

  @ApiPropertyOptional({ description: 'Role in project' })
  role?: string;

  @ApiProperty({ type: ProjectMemberProfileDto })
  member!: ProjectMemberProfileDto;
}

export class ProjectDataDto {
  @ApiProperty({ description: 'Project ID' })
  id!: string;

  @ApiProperty({ description: 'Project title' })
  title!: string;

  @ApiProperty({ description: 'Project slug' })
  slug!: string;

  @ApiProperty({ description: 'Project description' })
  description!: string;

  @ApiPropertyOptional({ description: 'Rich content (Tiptap JSON)' })
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Sanitized HTML content' })
  contentHtml?: string;

  @ApiPropertyOptional({ description: 'Project image URL' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'GitHub repository URL' })
  githubRepo?: string;

  @ApiPropertyOptional({ description: 'Demo/live URL' })
  demoUrl?: string;

  @ApiProperty({ type: [String], description: 'Normalized tag slugs' })
  tags!: string[];

  @ApiProperty({ type: [ProjectMemberDataDto] })
  members!: ProjectMemberDataDto[];

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: string;
}

export class ProjectsListDataDto {
  @ApiProperty({ type: [ProjectDataDto] })
  items!: ProjectDataDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class ProjectEditorImageUploadDto {
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
