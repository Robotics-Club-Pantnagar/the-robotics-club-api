import {
  IsString,
  IsEmail,
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Matches,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import { Position } from '../../generated/prisma/client';

export class FindMembersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or username' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by position title' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Filter by college ID' })
  @IsOptional()
  @IsString()
  collegeId?: string;

  @ApiPropertyOptional({ description: 'Filter by department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by graduation year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  graduationYear?: number;

  @ApiPropertyOptional({
    description:
      'Filter by invitation state. true = invited/pending, false = accepted members',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  invited?: boolean;
}

export class InviteMemberPositionDto {
  @ApiProperty({
    description: 'Position title',
    enum: Position,
    example: Position.EXECUTIVE_MEMBER,
  })
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
    description: 'End month (1-12, null for ongoing)',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth?: number;

  @ApiPropertyOptional({
    description: 'End year (null for ongoing)',
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  endYear?: number;
}

export class InviteMemberDto {
  @ApiProperty({ description: 'Full name', example: 'Jane Smith' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Email address', example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Username (lowercase, numbers, underscores only)',
    example: 'jane_smith',
    pattern: '^[a-z0-9_]+$',
  })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Username must contain only lowercase letters, numbers, and underscores',
  })
  username!: string;

  @ApiProperty({ description: 'Profile image URL' })
  @IsUrl()
  imageUrl!: string;

  @ApiProperty({ description: 'College ID' })
  @IsString()
  collegeId!: string;

  @ApiProperty({ description: 'Department ID' })
  @IsString()
  departmentId!: string;

  @ApiProperty({
    description: 'College ID number (roll number)',
    example: 12345,
  })
  @IsInt()
  @IsPositive()
  collegeIdNo!: number;

  @ApiPropertyOptional({
    description: 'Expected graduation year',
    example: 2025,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  graduationYear?: number;

  @ApiProperty({
    description:
      'Initial position history for the invited member profile (at least one entry required)',
    type: [InviteMemberPositionDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InviteMemberPositionDto)
  positions!: InviteMemberPositionDto[];
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'College ID' })
  @IsOptional()
  @IsString()
  collegeId?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'College ID number (roll number)',
    example: 12345,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  collegeIdNo?: number;

  @ApiPropertyOptional({ description: 'Bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Graduation year',
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  graduationYear?: number;

  @ApiPropertyOptional({ description: 'Instagram handle' })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional({ description: 'LinkedIn URL' })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional({ description: 'GitHub username' })
  @IsOptional()
  @IsString()
  github?: string;
}

export class MemberPositionSummaryDto {
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

export class MemberCollegeDto {
  @ApiProperty({ description: 'College ID' })
  id!: string;

  @ApiProperty({ description: 'College name' })
  name!: string;

  @ApiProperty({ description: 'College code' })
  code!: string;

  @ApiPropertyOptional({ description: 'College location' })
  location?: string;
}

export class MemberDepartmentDto {
  @ApiProperty({ description: 'Department ID' })
  id!: string;

  @ApiProperty({ description: 'Department name' })
  name!: string;

  @ApiProperty({ description: 'Department code' })
  code!: string;

  @ApiProperty({ description: 'College ID this department belongs to' })
  collegeId!: string;
}

export class MemberListItemDto {
  @ApiProperty({ description: 'Member ID' })
  id!: string;

  @ApiProperty({ description: 'Full name' })
  name!: string;

  @ApiProperty({ description: 'Email address' })
  email!: string;

  @ApiProperty({ description: 'Username' })
  username!: string;

  @ApiProperty({ description: 'Profile image URL' })
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Bio' })
  bio?: string;

  @ApiProperty({ description: 'College ID number (roll number)' })
  collegeIdNo!: number;

  @ApiPropertyOptional({ description: 'Graduation year' })
  graduationYear?: number;

  @ApiPropertyOptional({ description: 'Instagram handle' })
  instagram?: string;

  @ApiPropertyOptional({ description: 'LinkedIn URL' })
  linkedin?: string;

  @ApiPropertyOptional({ description: 'GitHub username' })
  github?: string;

  @ApiProperty({ description: 'College ID' })
  collegeId!: string;

  @ApiProperty({ description: 'Department ID' })
  departmentId!: string;

  @ApiProperty({ type: MemberCollegeDto })
  college!: MemberCollegeDto;

  @ApiProperty({ type: MemberDepartmentDto })
  department!: MemberDepartmentDto;

  @ApiProperty({
    description: 'Whether invitation has been accepted',
    example: true,
  })
  acceptedInvitation!: boolean;

  @ApiProperty({
    description: 'Member joined timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  joinedAt!: string;

  @ApiPropertyOptional({
    description: 'Invitation accepted timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  acceptedAt?: string;

  @ApiPropertyOptional({
    type: MemberPositionSummaryDto,
    description: 'Latest position snapshot for first/list fetch',
  })
  currentPosition?: MemberPositionSummaryDto;
}

export class MemberDetailDto extends MemberListItemDto {
  @ApiProperty({ type: [MemberPositionSummaryDto] })
  positions!: MemberPositionSummaryDto[];
}

export class MembersListDataDto {
  @ApiProperty({ type: [MemberListItemDto] })
  items!: MemberListItemDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class MemberInviteDataDto extends MemberListItemDto {
  @ApiProperty({
    description:
      'Invitation flow status message for pending member profile creation',
  })
  message!: string;
}
