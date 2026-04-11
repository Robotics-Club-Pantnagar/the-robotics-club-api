import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto';
import {
  CONTENT_VIEW_VALUES,
  type ContentView,
} from '../../common/dto/content-view.dto';
import { toStringArrayQuery } from '../../utils/query-array.util';

export const TAG_CONTENT_TARGET_VALUES = ['blogs', 'projects', 'both'] as const;

export type TagContentTarget = (typeof TAG_CONTENT_TARGET_VALUES)[number];

export class FindContentByTagsDto extends PaginationDto {
  @ApiProperty({
    description:
      'Array of tags used for filtering content. Accepts repeated query keys or a single key.',
    type: [String],
    example: ['ai', 'machine-learning'],
  })
  @Transform(({ value }) => toStringArrayQuery(value))
  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @ApiPropertyOptional({
    description: 'Which resources to return for the provided tags',
    enum: TAG_CONTENT_TARGET_VALUES,
    default: 'both',
  })
  @IsOptional()
  @IsIn([...TAG_CONTENT_TARGET_VALUES])
  type?: TagContentTarget = 'both';

  @ApiPropertyOptional({
    description:
      'Controls rich content fields in response items. both=content+contentHtml, html=only contentHtml, json=only content, none=exclude both.',
    enum: CONTENT_VIEW_VALUES,
    default: 'html',
  })
  @IsOptional()
  @IsIn([...CONTENT_VIEW_VALUES])
  contentView?: ContentView = 'html';
}

export class SearchTagsDto {
  @ApiProperty({
    description: 'Free-text query for tag suggestions',
    example: 'first thir',
  })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of tag suggestions to return',
    default: 10,
    minimum: 1,
    maximum: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number = 10;
}
