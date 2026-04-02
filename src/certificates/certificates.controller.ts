import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CertificatesService } from './certificates.service';
import {
  UpdateCertificateTemplateDto,
  CertificateStatusResponse,
  MyCertificateResponse,
  GenerationResultDto,
} from './dto';
import { TeamAdmin, UserAuth, CurrentUser } from '../auth/decorators';
import type { UserPrincipal } from '../auth/types';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  // ========================
  // Admin Endpoints
  // ========================

  @Post('events/:eventId/generate')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Bulk generate certificates for all event participants (Admin only)',
    description:
      'Adds certificate generation jobs to the background queue. Certificates are generated asynchronously and stored in Cloudinary.',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({
    status: 202,
    description: 'Certificate generation jobs queued',
    type: GenerationResultDto,
  })
  async bulkGenerateCertificates(
    @Param('eventId') eventId: string,
  ): Promise<GenerationResultDto> {
    return this.certificatesService.bulkGenerateCertificates(eventId);
  }

  @Post('events/:eventId/reissue/:participantId')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Reissue certificate for a specific participant (Admin only)',
    description:
      'Only allowed if certificate was already generated. Regenerates using latest template and data.',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiParam({ name: 'participantId', description: 'Participant ID' })
  async reissueCertificate(
    @Param('eventId') eventId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.certificatesService.reissueCertificate(eventId, participantId);
  }

  @Get('events/:eventId/status')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Get certificate generation status for an event (Admin only)',
    description:
      'Event-scoped status: combines database counts for that event with queue jobs filtered to that event.',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Certificate generation status',
    type: CertificateStatusResponse,
  })
  async getCertificateStatus(
    @Param('eventId') eventId: string,
  ): Promise<CertificateStatusResponse> {
    return this.certificatesService.getCertificateStatus(eventId);
  }

  @Put('events/:eventId/template')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Update certificate template for an event (Admin only)',
    description:
      'Set custom HTML template with placeholders: {{name}}, {{eventTitle}}, {{date}}, {{college}}, {{department}}',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async updateEventTemplate(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCertificateTemplateDto,
  ) {
    return this.certificatesService.updateEventTemplate(eventId, dto.template);
  }

  @Get('events/:eventId/template')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Get certificate template for an event (Admin only)',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async getEventTemplate(@Param('eventId') eventId: string) {
    return this.certificatesService.getEventTemplate(eventId);
  }

  // ========================
  // Participant Endpoints
  // ========================

  @Get('event/:eventId/participant/:collegeIdNo')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Download certificate PDF by event and participant college ID',
    description:
      'Public download endpoint. Certificate must already exist in storage.',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiParam({
    name: 'collegeIdNo',
    description: 'Participant college ID number',
    type: Number,
  })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 200,
    description: 'Certificate PDF file',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadCertificateByCollegeIdNo(
    @Param('eventId') eventId: string,
    @Param('collegeIdNo', ParseIntPipe) collegeIdNo: number,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { fileName, content } =
      await this.certificatesService.downloadCertificateByCollegeIdNo(
        eventId,
        collegeIdNo,
      );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(HttpStatus.OK).send(content);
  }

  @Get('my-certificates')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Get list of certificates for authenticated participant',
    description:
      'Returns certificates for past events. If certificate is not generated, isAvailable will be false.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of participant certificates',
    type: [MyCertificateResponse],
  })
  async getMyCertificates(
    @CurrentUser() user: UserPrincipal,
  ): Promise<MyCertificateResponse[]> {
    return this.certificatesService.getMyCertificates(user.id);
  }

  @Get('events/:eventId/my-certificate')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Get certificate URL for a specific event (Participant)',
    description:
      "Returns the Cloudinary URL for the participant's certificate if generated",
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  async getMyEventCertificate(
    @Param('eventId') eventId: string,
    @CurrentUser() user: UserPrincipal,
  ) {
    return this.certificatesService.getParticipantCertificate(user.id, eventId);
  }
}
