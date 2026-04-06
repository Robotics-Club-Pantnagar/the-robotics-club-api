import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const CONTENT_VIEW_VALUES = ['both', 'html', 'json', 'none'] as const;
export type ContentView = (typeof CONTENT_VIEW_VALUES)[number];

export class ContentViewQueryDto {
  @ApiPropertyOptional({
    description:
      'Controls rich content fields in responses. both=content+contentHtml, html=only contentHtml, json=only content, none=exclude both.',
    enum: CONTENT_VIEW_VALUES,
    default: 'both',
  })
  @IsOptional()
  @IsIn([...CONTENT_VIEW_VALUES])
  contentView?: ContentView = 'both';
}
