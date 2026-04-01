import { ClerkClient, createClerkClient } from '@clerk/backend';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClerkService {
  public userClient: ClerkClient;
  public teamClient: ClerkClient;

  constructor(private config: ConfigService) {
    const userSecretKey = this.config.get<string>('CLERK_USER_SECRET_KEY');
    const teamSecretKey = this.config.get<string>('CLERK_TEAM_SECRET_KEY');

    this.userClient = createClerkClient({
      secretKey: userSecretKey,
    });

    this.teamClient = createClerkClient({
      secretKey: teamSecretKey,
    });
  }
}
