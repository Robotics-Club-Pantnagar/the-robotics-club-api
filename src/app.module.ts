import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClerkModule } from './clerk/clerk.module';
import { CollegesModule } from './colleges/colleges.module';
import { DepartmentsModule } from './departments/departments.module';
import { EventsModule } from './events/events.module';
import { ParticipantsModule } from './participants/participants.module';
import { TeamsModule } from './teams/teams.module';
import { MembersModule } from './members/members.module';
import { PositionsModule } from './positions/positions.module';
import { ProjectsModule } from './projects/projects.module';
import { BlogsModule } from './blogs/blogs.module';
import { CertificatesModule } from './certificates/certificates.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { QueueModule } from './queue/queue.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute per IP
      },
    ]),
    PrismaModule,
    AuthModule,
    ClerkModule,
    CacheModule,
    CloudinaryModule,
    QueueModule,
    CollegesModule,
    DepartmentsModule,
    EventsModule,
    ParticipantsModule,
    TeamsModule,
    MembersModule,
    PositionsModule,
    ProjectsModule,
    BlogsModule,
    CertificatesModule,
    WebhooksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
