import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ClerkModule } from '../clerk/clerk.module';

@Module({
  imports: [PrismaModule, ClerkModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
