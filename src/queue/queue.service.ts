import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { CERTIFICATE_QUEUE } from './queue.config';

export interface CertificateJobData {
  eventId: string;
  participantId: string;
  eventParticipantId: string;
  participantName: string;
  participantEmail: string;
  collegeName: string;
  departmentName: string;
  eventTitle: string;
  eventDates: string;
  eventYear?: number;
  template: string;
  isReissue?: boolean;
}

export interface BulkCertificateJobData {
  eventId: string;
  participants: Array<{
    participantId: string;
    eventParticipantId: string;
    participantName: string;
    participantEmail: string;
    collegeName: string;
    departmentName: string;
  }>;
  eventTitle: string;
  eventDates: string;
  eventYear: number;
  template: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(CERTIFICATE_QUEUE) private certificateQueue: Queue,
  ) {}

  async addCertificateJob(data: CertificateJobData): Promise<Job> {
    const jobId = `cert-${data.eventId}-${data.participantId}`;

    this.logger.log(
      `Adding certificate job: ${jobId} for ${data.participantName}`,
    );

    return this.certificateQueue.add('generate-certificate', data, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    });
  }

  async addBulkCertificateJobs(
    data: BulkCertificateJobData,
  ): Promise<{ jobCount: number; eventId: string }> {
    this.logger.log(
      `Adding bulk certificate jobs for event: ${data.eventId}, participants: ${data.participants.length}`,
    );

    const jobs = data.participants.map((participant) => ({
      name: 'generate-certificate',
      data: {
        eventId: data.eventId,
        participantId: participant.participantId,
        eventParticipantId: participant.eventParticipantId,
        participantName: participant.participantName,
        participantEmail: participant.participantEmail,
        collegeName: participant.collegeName,
        departmentName: participant.departmentName,
        eventTitle: data.eventTitle,
        eventDates: data.eventDates,
        eventYear: data.eventYear,
        template: data.template,
        isReissue: false,
      } as CertificateJobData,
      opts: {
        jobId: `cert-${data.eventId}-${participant.participantId}`,
        attempts: 3,
        backoff: {
          type: 'exponential' as const,
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    }));

    await this.certificateQueue.addBulk(jobs);

    return { jobCount: jobs.length, eventId: data.eventId };
  }

  async addReissueCertificateJob(data: CertificateJobData): Promise<Job> {
    const jobId = `cert-reissue-${data.eventId}-${data.participantId}-${Date.now()}`;

    this.logger.log(
      `Adding reissue certificate job: ${jobId} for ${data.participantName}`,
    );

    return this.certificateQueue.add(
      'generate-certificate',
      { ...data, isReissue: true },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    );
  }

  async getJobsByEvent(
    eventId: string,
  ): Promise<{ completed: number; failed: number; pending: number }> {
    const jobs = await this.certificateQueue.getJobs([
      'completed',
      'failed',
      'waiting',
      'active',
    ]);

    const eventJobs = jobs.filter((job) => {
      const data = job.data as CertificateJobData | undefined;
      return data && data.eventId === eventId;
    });

    let completed = 0;
    let failed = 0;
    let pending = 0;

    for (const job of eventJobs) {
      const state = await job.getState();
      if (state === 'completed') completed++;
      else if (state === 'failed') failed++;
      else pending++;
    }

    return { completed, failed, pending };
  }
}
