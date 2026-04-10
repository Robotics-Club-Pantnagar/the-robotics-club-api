import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Position } from '../../generated/prisma/client';

export class CreatePositionDto {
  @ApiProperty({ description: 'Position title', enum: Position })
  @IsEnum(Position)
  position!: Position;

  @ApiProperty({
    description: 'Start month (1-12)',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth!: number;

  @ApiProperty({
    description: 'Start year',
    example: 2024,
    minimum: 2000,
    maximum: 2100,
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  startYear!: number;

  @ApiPropertyOptional({
    description: 'End month (1-12, null for current)',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth?: number;

  @ApiPropertyOptional({
    description: 'End year (null for current)',
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  endYear?: number;
}

export class UpdatePositionDto {
  @ApiPropertyOptional({ description: 'Position title', enum: Position })
  @IsOptional()
  @IsEnum(Position)
  position?: Position;

  @ApiPropertyOptional({
    description: 'Start month (1-12)',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth?: number;

  @ApiPropertyOptional({
    description: 'Start year',
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  startYear?: number;

  @ApiPropertyOptional({
    description: 'End month (1-12)',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth?: number;

  @ApiPropertyOptional({
    description: 'End year',
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  endYear?: number;
}

export class GetLeadershipQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by year (returns positions active during that year). If not provided, returns current leadership.',
    example: 2024,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class PositionMemberLatestPositionDto {
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

export class PositionMemberCollegeDto {
  @ApiProperty({ description: 'College ID' })
  id!: string;

  @ApiProperty({ description: 'College name' })
  name!: string;

  @ApiProperty({ description: 'College code' })
  code!: string;

  @ApiPropertyOptional({ description: 'College location' })
  location?: string;
}

export class PositionMemberDepartmentDto {
  @ApiProperty({ description: 'Department ID' })
  id!: string;

  @ApiProperty({ description: 'Department name' })
  name!: string;

  @ApiProperty({ description: 'Department code' })
  code!: string;

  @ApiProperty({ description: 'College ID this department belongs to' })
  collegeId!: string;
}

export class PositionMemberSummaryDto {
  @ApiProperty({ description: 'Member ID' })
  id!: string;

  @ApiProperty({ description: 'Member name' })
  name!: string;

  @ApiProperty({ description: 'Member email' })
  email!: string;

  @ApiProperty({ description: 'Member username' })
  username!: string;

  @ApiProperty({ description: 'Profile image URL' })
  imageUrl!: string;

  @ApiProperty({ description: 'College ID' })
  collegeId!: string;

  @ApiProperty({ description: 'Department ID' })
  departmentId!: string;

  @ApiProperty({ type: PositionMemberCollegeDto })
  college!: PositionMemberCollegeDto;

  @ApiProperty({ type: PositionMemberDepartmentDto })
  department!: PositionMemberDepartmentDto;

  @ApiPropertyOptional({
    type: PositionMemberLatestPositionDto,
    description: 'Latest known member position for first-load display',
  })
  latestPosition?: PositionMemberLatestPositionDto;
}

export class PositionHistoryItemDto {
  @ApiProperty({ description: 'Position record ID' })
  id!: string;

  @ApiProperty({ description: 'Member ID' })
  memberId!: string;

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

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: string;
}

export class LeadershipPositionItemDto extends PositionHistoryItemDto {
  @ApiProperty({ type: PositionMemberSummaryDto })
  member!: PositionMemberSummaryDto;
}
