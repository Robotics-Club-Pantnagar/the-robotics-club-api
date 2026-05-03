import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';

jest.mock('../src/utils/tiptap-content.util', () => ({
  tiptapJsonToHtml: () => '<p>mock</p>',
}));

import { AppModule } from './../src/app.module';

const prismaServiceMock: Pick<
  PrismaService,
  'onModuleInit' | 'onModuleDestroy' | '$connect' | '$disconnect'
> = {
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

const queueServiceMock = {
  addCertificateJob: jest.fn(),
  addBulkCertificateJobs: jest.fn(),
  addReissueCertificateJob: jest.fn(),
  getJobsByEvent: jest.fn(),
};


describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(QueueService)
      .useValue(queueServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
