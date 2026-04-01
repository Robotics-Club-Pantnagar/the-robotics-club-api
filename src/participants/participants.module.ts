import { Module } from '@nestjs/common';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
