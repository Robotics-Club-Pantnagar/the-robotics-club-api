import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('clerk/user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle participant Clerk webhook events',
    description:
      'Receives participant Clerk webhook events. Verifies the svix-signature header before processing.',
  })
  @ApiHeader({
    name: 'svix-id',
    description: 'Svix webhook ID',
    required: true,
  })
  @ApiHeader({
    name: 'svix-timestamp',
    description: 'Svix timestamp',
    required: true,
  })
  @ApiHeader({
    name: 'svix-signature',
    description: 'Svix signature for verification',
    required: true,
  })
  async handleUserClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    return this.webhooksService.handleUserClerkWebhook(req.rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  }

  @Post('clerk/team')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle team/member Clerk webhook events',
    description:
      'Receives team/member Clerk webhook events. Verifies the svix-signature header before processing.',
  })
  @ApiHeader({
    name: 'svix-id',
    description: 'Svix webhook ID',
    required: true,
  })
  @ApiHeader({
    name: 'svix-timestamp',
    description: 'Svix timestamp',
    required: true,
  })
  @ApiHeader({
    name: 'svix-signature',
    description: 'Svix signature for verification',
    required: true,
  })
  async handleTeamClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    return this.webhooksService.handleTeamClerkWebhook(req.rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  }
}
