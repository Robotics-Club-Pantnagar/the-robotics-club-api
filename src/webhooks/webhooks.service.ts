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

interface ClerkManagedProfilePayload {
  name: string;
  email: string;
  username: string;
  imageUrl?: string;
}

interface ClerkWebhookUserData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    id: string;
  }>;
  primary_email_address_id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string;
  public_metadata?: Record<string, unknown>;
}

interface ClerkUserCreatedEvent {
  data: ClerkWebhookUserData;
  type: 'user.created';
}

interface ClerkUserUpdatedEvent {
  data: ClerkWebhookUserData;
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
        if (audience === 'participant') {
          this.logger.log(
            `Ignoring participant user.created webhook for Clerk user ${
              (event as ClerkUserCreatedEvent).data.id
            }`,
          );
          return {
            received: true,
            processed: false,
            reason: 'Participants are created through custom signup endpoint',
          };
        }

        return this.handleMemberCreated(event as ClerkUserCreatedEvent);
      case 'user.updated':
        return this.handleUserUpdated(event as ClerkUserUpdatedEvent, audience);
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

  private async handleMemberCreated(event: ClerkUserCreatedEvent) {
    const profile = this.extractProfileFromWebhook(event.data);
    if (!profile) {
      this.logger.warn(
        `No primary email found for Clerk user ${event.data.id}`,
      );
      return { received: true, processed: false, reason: 'No primary email' };
    }

    const member = await this.membersService.createFromWebhook(
      event.data.id,
      profile,
    );

    if (!member) {
      this.logger.log(
        `No pending member found to activate for Clerk user ${event.data.id}`,
      );
      return {
        received: true,
        processed: false,
        reason: 'No pending member found',
      };
    }

    this.logger.log(
      `Member ${member.email} activated via user.created webhook`,
    );
    return { received: true, processed: true, memberId: member.id };
  }

  private async handleUserUpdated(
    event: ClerkUserUpdatedEvent,
    audience: 'participant' | 'member',
  ) {
    const profile = this.extractProfileFromWebhook(event.data);
    if (!profile) {
      this.logger.warn(
        `No primary email found for Clerk user ${event.data.id}`,
      );
      return { received: true, processed: false, reason: 'No primary email' };
    }

    if (audience === 'participant') {
      const participant =
        await this.participantsService.syncParticipantFromWebhook(
          event.data.id,
          profile,
        );

      if (participant) {
        this.logger.log(`Participant ${participant.email} synced via webhook`);
        return {
          received: true,
          processed: true,
          participantId: participant.id,
        };
      }

      this.logger.log(
        `No participant profile found for Clerk user ${event.data.id}`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Participant profile not created yet',
      };
    }

    const member = await this.membersService.syncMemberFromWebhook(
      event.data.id,
      profile,
    );

    if (member) {
      this.logger.log(`Member ${member.email} synced via webhook`);
      return { received: true, processed: true, memberId: member.id };
    }

    this.logger.log(`No member found for Clerk user ${event.data.id}`);
    return {
      received: true,
      processed: false,
      reason: 'No matching member found',
    };
  }

  private extractProfileFromWebhook(
    data: ClerkWebhookUserData,
  ): ClerkManagedProfilePayload | null {
    const primaryEmail =
      data.email_addresses.find(
        (emailAddress) => emailAddress.id === data.primary_email_address_id,
      )?.email_address ?? data.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      return null;
    }

    const normalizedEmail = primaryEmail.toLowerCase();
    const username = this.normalizeUsername(
      data.username,
      normalizedEmail,
      data.id,
    );
    const name = this.buildDisplayName(
      data.first_name,
      data.last_name,
      username,
      normalizedEmail,
    );

    return {
      name,
      email: normalizedEmail,
      username,
      imageUrl: data.image_url,
    };
  }

  private normalizeUsername(
    rawUsername: string | null | undefined,
    email: string,
    userId: string,
  ): string {
    const source = rawUsername?.trim() || email.split('@')[0] || userId;
    const normalized = source
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (normalized.length > 0) {
      return normalized;
    }

    const fallbackSeed = userId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `user_${fallbackSeed.slice(-12) || 'member'}`;
  }

  private buildDisplayName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    username: string,
    email: string,
  ): string {
    const nameParts = [firstName?.trim(), lastName?.trim()].filter(
      (part): part is string => Boolean(part && part.length > 0),
    );
    if (nameParts.length > 0) {
      return nameParts.join(' ');
    }

    return username || email.split('@')[0];
  }
}
