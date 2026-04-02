import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { TemplateService } from './template.service';
import { CERTIFICATE_QUEUE } from '../queue/queue.config';
import { CertificateJobData } from '../queue/queue.service';

@Processor(CERTIFICATE_QUEUE)
export class CertificateProcessor extends WorkerHost {
  private readonly logger = new Logger(CertificateProcessor.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private templateService: TemplateService,
  ) {
    super();
  }

  async process(job: Job<CertificateJobData>): Promise<{ url: string }> {
    const { data } = job;

    this.logger.log(
      `Processing certificate job ${job.id} for participant: ${data.participantName}`,
    );

    try {
      // Generate PDF buffer
      const pdfBuffer = await this.generatePdfFromTemplate(data);

      // Upload to Cloudinary
      const publicId = this.cloudinaryService.getCertificatePath(
        data.eventId,
        data.participantId,
      );

      const uploadResult = await this.cloudinaryService.uploadPdfBuffer(
        pdfBuffer,
        publicId,
        'certificates',
      );

      this.logger.log(
        `Certificate uploaded to Cloudinary: ${uploadResult.secureUrl}`,
      );

      // Update database with certificate URL
      await this.prisma.eventParticipant.update({
        where: { id: data.eventParticipantId },
        data: { certificate: uploadResult.secureUrl },
      });

      this.logger.log(
        `Certificate job ${job.id} completed successfully for ${data.participantName}`,
      );

      return { url: uploadResult.secureUrl };
    } catch (error) {
      this.logger.error(
        `Certificate job ${job.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private async generatePdfFromTemplate(
    data: CertificateJobData,
  ): Promise<Buffer> {
    // Parse template with data
    const templateData = {
      name: data.participantName,
      eventTitle: data.eventTitle,
      date: data.eventDates,
      college: data.collegeName,
      department: data.departmentName,
    };

    const parsedTemplate = this.templateService.parseTemplate(
      data.template,
      templateData,
    );

    const templateText = this.extractPlainTextFromHtml(parsedTemplate);
    const shouldUseTemplateLayout = this.isCustomTemplate(data.template);

    return this.generatePdfWithPdfKit(
      templateData,
      shouldUseTemplateLayout ? templateText : undefined,
    );
  }

  private generatePdfWithPdfKit(
    data: {
      name: string;
      eventTitle: string;
      date: string;
      college: string;
      department: string;
    },
    templateText?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 50,
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // Border
        doc
          .rect(30, 30, pageWidth - 60, pageHeight - 60)
          .lineWidth(3)
          .stroke('#1a365d');

        doc
          .rect(40, 40, pageWidth - 80, pageHeight - 80)
          .lineWidth(1)
          .stroke('#2c5282');

        if (templateText) {
          doc
            .font('Helvetica-Bold')
            .fontSize(32)
            .fillColor('#1a365d')
            .text('CERTIFICATE', 0, 90, { align: 'center' });

          doc
            .font('Helvetica')
            .fontSize(13)
            .fillColor('#2d3748')
            .text(templateText, 80, 160, {
              width: pageWidth - 160,
              align: 'left',
              lineGap: 4,
            });

          doc.end();
          return;
        }

        // Title
        doc
          .font('Helvetica-Bold')
          .fontSize(40)
          .fillColor('#1a365d')
          .text('CERTIFICATE', 0, 80, { align: 'center' });

        doc
          .font('Helvetica')
          .fontSize(20)
          .fillColor('#4a5568')
          .text('OF PARTICIPATION', 0, 130, { align: 'center' });

        // Subtitle
        doc
          .fontSize(14)
          .fillColor('#718096')
          .text('This is to certify that', 0, 180, { align: 'center' });

        // Participant name
        doc
          .font('Helvetica-Bold')
          .fontSize(32)
          .fillColor('#2d3748')
          .text(data.name, 0, 210, { align: 'center' });

        // College info
        doc
          .font('Helvetica')
          .fontSize(14)
          .fillColor('#718096')
          .text(`${data.college} - ${data.department}`, 0, 260, {
            align: 'center',
          });

        // Event participation text
        doc
          .fontSize(14)
          .fillColor('#718096')
          .text('has successfully participated in', 0, 300, {
            align: 'center',
          });

        // Event title
        doc
          .font('Helvetica-Bold')
          .fontSize(26)
          .fillColor('#2c5282')
          .text(data.eventTitle, 0, 330, { align: 'center' });

        // Date
        doc
          .font('Helvetica')
          .fontSize(14)
          .fillColor('#718096')
          .text(`held on ${data.date}`, 0, 375, { align: 'center' });

        // Footer - Organization name
        doc
          .fontSize(16)
          .fillColor('#1a365d')
          .text('The Robotics Club', 0, 450, { align: 'center' });

        // Date issued
        const today = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc
          .fontSize(10)
          .fillColor('#a0aec0')
          .text(`Issued on ${today}`, 0, 480, {
            align: 'center',
          });

        doc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private isCustomTemplate(template: string): boolean {
    const defaultTemplate = this.templateService.getDefaultTemplate();
    return (
      this.normalizeTemplate(template) !==
      this.normalizeTemplate(defaultTemplate)
    );
  }

  private normalizeTemplate(template: string): string {
    return template.replace(/\s+/g, ' ').trim();
  }

  private extractPlainTextFromHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/h1|\/h2|\/h3|\/h4|\/h5|\/h6|\/li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CertificateJobData>) {
    this.logger.log(`Job ${job.id} completed for ${job.data.participantName}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CertificateJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for ${job.data.participantName}: ${error.message}`,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job<CertificateJobData>, progress: number | object) {
    this.logger.log(`Job ${job.id} progress: ${JSON.stringify(progress)}`);
  }
}
