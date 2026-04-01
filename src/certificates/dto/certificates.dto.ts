import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkGenerateCertificatesDto {
  @ApiProperty({ description: 'Event ID to generate certificates for' })
  @IsString()
  eventId: string;
}
