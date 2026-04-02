import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { TemplateService } from './template.service';
import {
  CertificateStatusResponse,
  MyCertificateResponse,
  GenerationResultDto,
} from './dto';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private templateService: TemplateService,
  ) {}

  /**
   * Admin: Bulk generate certificates for all event participants
   */
  async bulkGenerateCertificates(
    eventId: string,
  ): Promise<GenerationResultDto> {
    // Fetch event with template and participants
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        schedule: { orderBy: { day: 'asc' } },
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

    // Use event template or default
    const template =
      event.certificateTemplate || this.templateService.getDefaultTemplate();

    // Validate template
    const validation = this.templateService.validateTemplate(template);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid template. Missing required placeholders: ${validation.missingFields.join(', ')}`,
      );
    }

    // Check if event has ended (optional - can enable stricter rules)
    const lastSchedule = event.schedule[event.schedule.length - 1];
    const now = new Date();
    if (lastSchedule && new Date(lastSchedule.day) > now) {
      throw new BadRequestException(
        'Cannot generate certificates for an event that has not ended yet',
      );
    }

    if (event.participants.length === 0) {
      throw new BadRequestException(
        'No participants registered for this event',
      );
    }

    // Format event dates
    const eventDates = event.schedule
      .map((s) =>
        new Date(s.day).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      )
      .join(', ');

    // Filter participants who don't have certificates yet
    const participantsToProcess = event.participants.filter(
      (ep) => !ep.certificate,
    );

    if (participantsToProcess.length === 0) {
      return {
        jobsQueued: 0,
        eventId,
        message: 'All participants already have certificates',
      };
    }

    // Add bulk jobs to queue
    const result = await this.queueService.addBulkCertificateJobs({
      eventId,
      eventTitle: event.title,
      eventDates,
      template,
      participants: participantsToProcess.map((ep) => ({
        participantId: ep.participantId,
        eventParticipantId: ep.id,
        participantName: ep.participant.name,
        participantEmail: ep.participant.email,
        collegeName: ep.participant.college.name,
        departmentName: ep.participant.department.name,
      })),
    });

    return {
      jobsQueued: result.jobCount,
      eventId: result.eventId,
      message: `${result.jobCount} certificate generation jobs queued successfully`,
    };
  }

  /**
   * Admin: Reissue certificate for a specific participant
   */
  async reissueCertificate(
    eventId: string,
    participantId: string,
  ): Promise<{ message: string; jobId: string }> {
    // Find the event participant registration
    const registration = await this.prisma.eventParticipant.findUnique({
      where: { eventId_participantId: { eventId, participantId } },
      include: {
        event: {
          include: { schedule: { orderBy: { day: 'asc' } } },
        },
        participant: {
          include: { college: true, department: true },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Participant registration not found');
    }

    // Reissue is only allowed if certificate already exists
    if (!registration.certificate) {
      throw new BadRequestException(
        'Cannot reissue certificate. Certificate has not been generated yet. Use bulk generation first.',
      );
    }

    const event = registration.event;
    const template =
      event.certificateTemplate || this.templateService.getDefaultTemplate();

    const eventDates = event.schedule
      .map((s) =>
        new Date(s.day).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      )
      .join(', ');

    // Add reissue job to queue
    const job = await this.queueService.addReissueCertificateJob({
      eventId,
      participantId,
      eventParticipantId: registration.id,
      participantName: registration.participant.name,
      participantEmail: registration.participant.email,
      collegeName: registration.participant.college.name,
      departmentName: registration.participant.department.name,
      eventTitle: event.title,
      eventDates,
      template,
      isReissue: true,
    });

    return {
      message: 'Certificate reissue job queued successfully',
      jobId: job.id || 'unknown',
    };
  }

  /**
   * Get certificate generation status for an event
   */
  async getCertificateStatus(
    eventId: string,
  ): Promise<CertificateStatusResponse> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          select: { id: true, certificate: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const totalParticipants = event.participants.length;
    const certificatesGenerated = event.participants.filter(
      (p) => p.certificate,
    ).length;
    const certificatesPending = totalParticipants - certificatesGenerated;

    // Get queue status for this event
    const queueStatus = await this.queueService.getJobsByEvent(eventId);

    return {
      eventId,
      totalParticipants,
      certificatesGenerated,
      certificatesPending,
      jobsInQueue: queueStatus.pending,
      jobsFailed: queueStatus.failed,
    };
  }

  /**
   * Participant: Get their certificates
   */
  async getMyCertificates(
    participantId: string,
  ): Promise<MyCertificateResponse[]> {
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
      certificateUrl: reg.certificate || undefined,
      isAvailable: !!reg.certificate,
      downloadUrl: reg.certificate ? reg.certificate : undefined,
    }));
  }

  /**
   * Get participant's certificate URL for a specific event
   */
  async getParticipantCertificate(
    participantId: string,
    eventId: string,
  ): Promise<{ url: string }> {
    const registration = await this.prisma.eventParticipant.findUnique({
      where: { eventId_participantId: { eventId, participantId } },
      select: { certificate: true },
    });

    if (!registration) {
      throw new NotFoundException('Participant not registered for this event');
    }

    if (!registration.certificate) {
      throw new BadRequestException('Certificate not generated yet');
    }

    return { url: registration.certificate };
  }

  /**
   * Public: Download certificate PDF by event and participant college ID number
   */
  async downloadCertificateByCollegeIdNo(
    eventId: string,
    collegeIdNo: number,
  ): Promise<{ fileName: string; content: Buffer }> {
    const registration = await this.prisma.eventParticipant.findFirst({
      where: {
        eventId,
        participant: {
          collegeIdNo,
        },
      },
      include: {
        event: {
          select: {
            title: true,
          },
        },
        participant: {
          select: {
            collegeIdNo: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(
        'Participant registration not found for this event',
      );
    }

    if (!registration.certificate) {
      throw new BadRequestException('Certificates not generated yet');
    }

    let downloadResponse: Awaited<ReturnType<typeof fetch>>;
    try {
      downloadResponse = await fetch(registration.certificate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch certificate from storage: ${message}`);
      throw new BadRequestException('Unable to download certificate');
    }

    if (!downloadResponse.ok) {
      throw new BadRequestException('Unable to download certificate');
    }

    const content = Buffer.from(await downloadResponse.arrayBuffer());
    if (content.length === 0) {
      throw new BadRequestException('Certificate file is empty');
    }

    const safeEventTitle = this.sanitizeForFileName(registration.event.title);
    const fileName = `${safeEventTitle}-${registration.participant.collegeIdNo}.pdf`;

    return {
      fileName,
      content,
    };
  }

  /**
   * Admin: Update certificate template for an event
   */
  async updateEventTemplate(
    eventId: string,
    template: string,
  ): Promise<{ message: string }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Validate template
    const validation = this.templateService.validateTemplate(template);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid template. Missing required placeholders: ${validation.missingFields.join(', ')}`,
      );
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { certificateTemplate: template },
    });

    return { message: 'Certificate template updated successfully' };
  }

  /**
   * Get event's certificate template
   */
  async getEventTemplate(eventId: string): Promise<{
    template: string;
    isDefault: boolean;
    placeholders: string[];
  }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { certificateTemplate: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const template =
      event.certificateTemplate || this.templateService.getDefaultTemplate();
    const isDefault = !event.certificateTemplate;
    const placeholders = this.templateService.extractPlaceholders(template);

    return { template, isDefault, placeholders };
  }

  private sanitizeForFileName(value: string): string {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return sanitized || 'certificate';
  }
}
