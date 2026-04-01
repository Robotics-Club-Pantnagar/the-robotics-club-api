import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async getCertificate(
    eventId: string,
    collegeIdNo: number,
  ): Promise<{ stream: PassThrough; filename: string }> {
    // Find the participant by collegeIdNo
    const participant = await this.prisma.participant.findFirst({
      where: { collegeIdNo },
      include: {
        college: true,
        department: true,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Verify participant attended the event
    const registration = await this.prisma.eventParticipant.findUnique({
      where: {
        eventId_participantId: { eventId, participantId: participant.id },
      },
      include: {
        event: {
          include: {
            schedule: { orderBy: { day: 'asc' } },
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Participant did not attend this event');
    }

    const event = registration.event;
    const eventDates = event.schedule.map((s) =>
      new Date(s.day).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    );

    // Generate PDF
    const stream = new PassThrough();
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
    });

    doc.pipe(stream);

    // Certificate design
    this.generateCertificatePdf(doc, {
      participantName: participant.name,
      eventTitle: event.title,
      eventDates: eventDates.join(', '),
      collegeName: participant.college.name,
      departmentName: participant.department.name,
    });

    doc.end();

    const filename = `certificate_${participant.name.replace(/\s+/g, '_')}_${event.title.replace(/\s+/g, '_')}.pdf`;

    return { stream, filename };
  }

  async getMyCertificates(participantId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: { collegeIdNo: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const registrations = await this.prisma.eventParticipant.findMany({
      where: { participantId },
      include: {
        event: {
          include: {
            schedule: { orderBy: { day: 'asc' } },
          },
        },
      },
    });

    // Only return certificates for past events
    const now = new Date();
    const pastEvents = registrations.filter((reg) => {
      const lastSchedule = reg.event.schedule[reg.event.schedule.length - 1];
      return lastSchedule && new Date(lastSchedule.day) < now;
    });

    return pastEvents.map((reg) => ({
      eventId: reg.eventId,
      eventTitle: reg.event.title,
      downloadUrl: `/certificates/event/${reg.eventId}/participant/${participant.collegeIdNo}`,
    }));
  }

  async bulkGenerate(eventId: string): Promise<{ count: number }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            participant: {
              include: { college: true, department: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // In a real implementation, this would:
    // 1. Generate PDFs for all participants
    // 2. Store them in cloud storage
    // 3. Send notification emails
    // For now, we just return the count

    return { count: event.participants.length };
  }

  private generateCertificatePdf(
    doc: PDFKit.PDFDocument,
    data: {
      participantName: string;
      eventTitle: string;
      eventDates: string;
      collegeName: string;
      departmentName: string;
    },
  ) {
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
      .text(data.participantName, 0, 210, { align: 'center' });

    // College info
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#718096')
      .text(`${data.collegeName} - ${data.departmentName}`, 0, 260, {
        align: 'center',
      });

    // Event participation text
    doc
      .fontSize(14)
      .fillColor('#718096')
      .text('has successfully participated in', 0, 300, { align: 'center' });

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
      .text(`held on ${data.eventDates}`, 0, 375, { align: 'center' });

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
    doc.fontSize(10).fillColor('#a0aec0').text(`Issued on ${today}`, 0, 480, {
      align: 'center',
    });
  }
}
