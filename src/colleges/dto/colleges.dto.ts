import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export class FindCollegesDto extends PaginationDto {
  @ApiProperty({
    description: 'Search term for college name or code',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateCollegeDto {
  @ApiProperty({ description: 'College name', example: 'MIT' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'College code', example: 'MIT001' })
  @IsString()
  code!: string;

  @ApiProperty({
    description: 'College location',
    example: 'Cambridge, MA',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateCollegeDto {
  @ApiProperty({ description: 'College name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'College code', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'College location', required: false })
  @IsOptional()
  @IsString()
  location?: string;
}
