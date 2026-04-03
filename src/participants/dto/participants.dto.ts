import { IsString, IsInt, IsPositive, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateParticipantDto {
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

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Academic year', example: '3rd Year' })
  @IsOptional()
  @IsString()
  year?: string;
}

export class UpdateParticipantDto {
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

  @ApiPropertyOptional({ description: 'Academic year' })
  @IsOptional()
  @IsString()
  year?: string;
}
