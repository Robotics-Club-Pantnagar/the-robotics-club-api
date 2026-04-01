import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserAuthGuard } from './user.guard';
import { TeamAdminGuard } from './team.guard';

@Injectable()
export class UserOrTeamAdminGuard implements CanActivate {
  constructor(
    private readonly userAuthGuard: UserAuthGuard,
    private readonly teamAdminGuard: TeamAdminGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      if (await this.userAuthGuard.canActivate(context)) {
        return true;
      }
    } catch {
      // Fall through to team-admin validation.
    }

    try {
      if (await this.teamAdminGuard.canActivate(context)) {
        return true;
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
