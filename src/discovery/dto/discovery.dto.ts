import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto';
import {
  CONTENT_VIEW_VALUES,
  type ContentView,
} from '../../common/dto/content-view.dto';

export const TAG_CONTENT_TARGET_VALUES = ['blogs', 'projects', 'both'] as const;

export type TagContentTarget = (typeof TAG_CONTENT_TARGET_VALUES)[number];

export class FindContentByTagsDto extends PaginationDto {
  @ApiProperty({
    description: 'Array of tags used for filtering content',
    type: [String],
    example: ['ai', 'machine-learning'],
  })
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
