import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './queue/queue.module';
import { PrismaModule } from './prisma/prisma.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CertificatesWorkerModule } from './certificates/certificates-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QueueModule,
    PrismaModule,
    CloudinaryModule,
    CertificatesWorkerModule,
  ],
})
export class WorkerModule {}
