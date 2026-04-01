import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipal, UserPrincipal } from './types';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type AuthRequest = Request & { user?: AuthPrincipal };

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = req.header('authorization') || req.header('Authorization');
    if (!auth) throw new UnauthorizedException('Missing Authorization header');

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

    const secretKey = this.config.get<string>('CLERK_USER_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('Server not configured for auth');
    }

    try {
      const payload = await verifyToken(token, { secretKey });

      const user: UserPrincipal = {
        type: 'user',
        id: payload.sub,
      };
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
