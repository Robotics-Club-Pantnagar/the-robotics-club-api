import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { MembersService } from '../members/members.service';
import { ParticipantsService } from '../participants/participants.service';

interface ClerkUserCreatedEvent {
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id: string;
    image_url?: string;
  };
  type: 'user.created';
}

interface ClerkUserUpdatedEvent {
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id: string;
    image_url?: string;
  };
  type: 'user.updated';
}

type ClerkWebhookEvent =
  | ClerkUserCreatedEvent
  | ClerkUserUpdatedEvent
  | { type: string; data: unknown };

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly userWebhookSecret: string;
  private readonly teamWebhookSecret: string;

  constructor(
    private config: ConfigService,
    private membersService: MembersService,
    private participantsService: ParticipantsService,
  ) {
    const fallback = this.config.get<string>('CLERK_WEBHOOK_SECRET') || '';
    this.userWebhookSecret =
      this.config.get<string>('CLERK_USER_WEBHOOK_SECRET') || fallback;
    this.teamWebhookSecret =
      this.config.get<string>('CLERK_TEAM_WEBHOOK_SECRET') || fallback;
  }

  async handleUserClerkWebhook(
    rawBody: Buffer | undefined,
    headers: {
      'svix-id'?: string;
      'svix-timestamp'?: string;
      'svix-signature'?: string;
    },
  ) {
    return this.handleClerkWebhookByAudience(
      rawBody,
      headers,
      this.userWebhookSecret,
      'participant',
    );
  }

  async handleTeamClerkWebhook(
    rawBody: Buffer | undefined,
    headers: {
      'svix-id'?: string;
      'svix-timestamp'?: string;
      'svix-signature'?: string;
    },
  ) {
    return this.handleClerkWebhookByAudience(
      rawBody,
      headers,
      this.teamWebhookSecret,
      'member',
    );
  }

  private async handleClerkWebhookByAudience(
    rawBody: Buffer | undefined,
    headers: {
      'svix-id'?: string;
      'svix-timestamp'?: string;
      'svix-signature'?: string;
    },
    secret: string,
    audience: 'participant' | 'member',
  ) {
    const event = this.verifyWebhookSignature(rawBody, headers, secret);

    this.logger.log(`Received Clerk ${audience} webhook event: ${event.type}`);

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        return this.handleUserLifecycleEvent(
          event as ClerkUserCreatedEvent | ClerkUserUpdatedEvent,
          audience,
        );
      default:
        this.logger.log(`Ignoring unhandled Clerk event type: ${event.type}`);
        return { received: true, type: event.type };
    }
  }

  private verifyWebhookSignature(
    rawBody: Buffer | undefined,
    headers: {
      'svix-id'?: string;
      'svix-timestamp'?: string;
      'svix-signature'?: string;
    },
    secret: string,
  ): ClerkWebhookEvent {
    if (!secret) {
      this.logger.error('Clerk webhook secret not configured');
      throw new InternalServerErrorException(
        'Clerk webhook secret is not configured',
      );
    }

    if (
      !headers['svix-id'] ||
      !headers['svix-timestamp'] ||
      !headers['svix-signature']
    ) {
      throw new UnauthorizedException('Missing Svix signature headers');
    }

    if (!rawBody) {
      throw new UnauthorizedException(
        'Missing raw body for webhook verification',
      );
    }

    try {
      const wh = new Webhook(secret);
      const payload = wh.verify(rawBody.toString(), {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      }) as ClerkWebhookEvent;
      return payload;
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async handleUserLifecycleEvent(
    event: ClerkUserCreatedEvent | ClerkUserUpdatedEvent,
    audience: 'participant' | 'member',
  ) {
    const { data } = event;

    // Find the primary email
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );

    if (!primaryEmail) {
      this.logger.warn(`No primary email found for Clerk user ${data.id}`);
      return { received: true, processed: false, reason: 'No primary email' };
    }

    if (audience === 'participant') {
      const participant =
        await this.participantsService.linkParticipantFromWebhook(
          primaryEmail.email_address,
          data.id,
        );

      if (participant) {
        this.logger.log(`Participant ${participant.email} linked via webhook`);
        return {
          received: true,
          processed: true,
          participantId: participant.id,
        };
      }

      this.logger.log(
        `No participant found for email ${primaryEmail.email_address}`,
      );
      return {
        received: true,
        processed: false,
        reason: 'No matching participant found',
      };
    }

    const member = await this.membersService.linkMemberFromWebhook(
      primaryEmail.email_address,
      data.id,
    );

    if (member) {
      this.logger.log(`Member ${member.email} linked via webhook`);
      return { received: true, processed: true, memberId: member.id };
    }

    this.logger.log(`No member found for email ${primaryEmail.email_address}`);
    return {
      received: true,
      processed: false,
      reason: 'No matching member found',
    };
  }
}
