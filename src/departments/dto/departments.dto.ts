import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Department name', example: 'Computer Science' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Department code', example: 'CS' })
  @IsString()
  code!: string;

  @ApiProperty({ description: 'College ID this department belongs to' })
  @IsString()
  collegeId!: string;
}

export class UpdateDepartmentDto {
  @ApiProperty({ description: 'Department name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Department code', required: false })
  @IsOptional()
  @IsString()
  code?: string;
}
