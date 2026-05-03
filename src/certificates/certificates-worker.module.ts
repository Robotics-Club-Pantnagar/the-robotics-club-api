import { Module } from '@nestjs/common';
import { CertificatesSharedModule } from './certificates-shared.module';
import { CertificateProcessor } from './certificate.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    QueueModule,
    PrismaModule,
    CloudinaryModule,
    CertificatesSharedModule,
  ],
  providers: [CertificateProcessor],
})
export class CertificatesWorkerModule {}
