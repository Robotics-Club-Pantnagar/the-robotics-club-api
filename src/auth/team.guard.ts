import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthPrincipal, TeamUserPrincipal } from './types';
import { verifyToken } from '@clerk/backend';
import { ClerkService } from '../clerk/clerk.service';

@Injectable()
export class TeamMemberGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly clerkService: ClerkService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type AuthRequest = Request & { user?: AuthPrincipal };

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = req.header('authorization') || req.header('Authorization');
    if (!auth) throw new UnauthorizedException('Missing Authorization header');

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

    const secretKey = this.config.get<string>('CLERK_TEAM_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('Server not configured for auth');
    }

    try {
      const payload = await verifyToken(token, { secretKey });
      const userId = payload.sub;

      const clerkUser =
        await this.clerkService.teamClient.users.getUser(userId);

      const metadata = clerkUser.publicMetadata as Record<string, unknown>;
      const role = metadata?.role === 'admin' ? 'admin' : 'member';

      const user: TeamUserPrincipal = { type: 'member', id: userId, role };
      req.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

@Injectable()
export class TeamAdminGuard implements CanActivate {
  constructor(private readonly memberGuard: TeamMemberGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = await this.memberGuard.canActivate(context);
    if (!ok) return false;

    type AuthRequest = Request & { user?: AuthPrincipal };
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const user = req.user as TeamUserPrincipal | undefined;
    if (!user) throw new UnauthorizedException('No team user attached');
    if (user.role !== 'admin') {
      throw new ForbiddenException('Requires team admin role');
    }
    return true;
  }
}
