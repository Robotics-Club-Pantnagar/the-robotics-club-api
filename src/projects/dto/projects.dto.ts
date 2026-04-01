import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

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
}

export class CreateProjectDto {
  @ApiProperty({ description: 'Project title', example: 'Autonomous Robot' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Short project description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Rich content (Quill Delta JSON)', type: Object })
  @IsObject()
  content: Record<string, unknown>;

  @ApiProperty({ description: 'HTML representation of content' })
  @IsString()
  contentHtml: string;

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

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

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
  memberId: string;

  @ApiPropertyOptional({
    description: 'Role in project',
    example: 'Lead Developer',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
