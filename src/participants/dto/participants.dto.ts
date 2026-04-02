import {
  IsString,
  IsEmail,
  IsInt,
  IsPositive,
  IsOptional,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateParticipantDto {
  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Username (lowercase, numbers, underscores only)',
    example: 'john_doe',
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

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

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

  @ApiPropertyOptional({ description: 'Academic year', example: '3rd Year' })
  @IsOptional()
  @IsString()
  year?: string;
}

export class UpdateParticipantDto {
  @ApiPropertyOptional({ description: 'Full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Academic year' })
  @IsOptional()
  @IsString()
  year?: string;
}
