import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { CertificateProcessor } from './certificate.processor';
import { TemplateService } from './template.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, QueueModule, CloudinaryModule],
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificateProcessor, TemplateService],
  exports: [CertificatesService, TemplateService],
})
export class CertificatesModule {}
