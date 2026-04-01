import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MembersModule } from '../members/members.module';
import { ParticipantsModule } from '../participants/participants.module';

@Module({
  imports: [MembersModule, ParticipantsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
