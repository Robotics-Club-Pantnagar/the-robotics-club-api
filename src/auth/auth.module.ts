import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserAuthGuard } from './user.guard';
import { TeamMemberGuard, TeamAdminGuard } from './team.guard';
import { UserOrTeamAdminGuard } from './user-or-team-admin.guard';
import { ClerkModule } from '../clerk/clerk.module';

@Global()
@Module({
  imports: [ConfigModule, ClerkModule],
  providers: [
    UserAuthGuard,
    TeamMemberGuard,
    TeamAdminGuard,
    UserOrTeamAdminGuard,
  ],
  exports: [
    UserAuthGuard,
    TeamMemberGuard,
    TeamAdminGuard,
    UserOrTeamAdminGuard,
  ],
})
export class AuthModule {}
