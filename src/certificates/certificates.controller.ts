import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { BulkGenerateCertificatesDto } from './dto';
import { TeamAdmin, UserAuth, CurrentUser } from '../auth/decorators';
import type { UserPrincipal } from '../auth/types';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('event/:eventId/participant/:collegeIdNo')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Download certificate PDF for participant (rate limited)',
  })
  @ApiProduces('application/pdf')
  async getCertificate(
    @Param('eventId') eventId: string,
    @Param('collegeIdNo', ParseIntPipe) collegeIdNo: number,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.certificatesService.getCertificate(
      eventId,
      collegeIdNo,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }

  @Get('my-certificates')
  @UserAuth()
  @ApiBearerAuth('user-auth')
  @ApiOperation({
    summary: 'Get list of certificates for authenticated participant',
  })
  getMyCertificates(@CurrentUser() user: UserPrincipal) {
    return this.certificatesService.getMyCertificates(user.id);
  }

  @Post('bulk-generate')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary:
      'Bulk generate certificates for all event participants (Admin only)',
  })
  bulkGenerate(@Body() bulkGenerateDto: BulkGenerateCertificatesDto) {
    return this.certificatesService.bulkGenerate(bulkGenerateDto.eventId);
  }
}
