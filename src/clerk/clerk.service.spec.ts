import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClerkService } from './clerk.service';

describe('ClerkService', () => {
  let service: ClerkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (
                key === 'CLERK_USER_SECRET_KEY' ||
                key === 'CLERK_TEAM_SECRET_KEY'
              ) {
                return 'test_secret_key';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<ClerkService>(ClerkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
