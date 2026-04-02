import {
  IsString,
  IsEmail,
  IsInt,
  IsPositive,
  IsOptional,
  Matches,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

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
