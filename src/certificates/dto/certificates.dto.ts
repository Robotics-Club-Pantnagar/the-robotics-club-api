import { IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCertificateTemplateDto {
  @ApiProperty({
    description:
      'HTML template for certificate generation. Use placeholders: {{name}}, {{eventTitle}}, {{date}}, {{college}}, {{department}}',
  })
  @IsString()
  template!: string;
}

export class CertificateStatusResponse {
  @ApiProperty({ description: 'Event ID' })
  eventId!: string;

  @ApiProperty({ description: 'Total participants' })
  totalParticipants!: number;

  @ApiProperty({ description: 'Certificates generated' })
  certificatesGenerated!: number;

  @ApiProperty({ description: 'Certificates pending' })
  certificatesPending!: number;

  @ApiProperty({ description: 'Jobs in queue' })
  jobsInQueue!: number;

  @ApiProperty({ description: 'Jobs failed' })
  jobsFailed!: number;
}

export class MyCertificateResponse {
  @ApiProperty({ description: 'Event ID' })
  eventId!: string;

  @ApiProperty({ description: 'Event title' })
  eventTitle!: string;

  @ApiPropertyOptional({ description: 'Certificate URL (if generated)' })
  certificateUrl?: string;

  @ApiProperty({ description: 'Whether certificate is available' })
  isAvailable!: boolean;

  @ApiPropertyOptional({ description: 'Download URL' })
  downloadUrl?: string;
}

export class GenerationResultDto {
  @ApiProperty({ description: 'Number of jobs queued' })
  jobsQueued!: number;

  @ApiProperty({ description: 'Event ID' })
  eventId!: string;

  @ApiProperty({ description: 'Status message' })
  message!: string;
}
