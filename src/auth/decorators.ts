import {
  applyDecorators,
  UseGuards,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { UserAuthGuard } from './user.guard';
import { TeamMemberGuard, TeamAdminGuard } from './team.guard';
import { UserOrTeamAdminGuard } from './user-or-team-admin.guard';
import { AuthPrincipal } from './types';

export function UserAuth() {
  return applyDecorators(UseGuards(UserAuthGuard));
}

export function TeamMember() {
  return applyDecorators(UseGuards(TeamMemberGuard));
}

export function TeamAdmin() {
  return applyDecorators(UseGuards(TeamAdminGuard));
}

export function UserOrTeamAdmin() {
  return applyDecorators(UseGuards(UserOrTeamAdminGuard));
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    type AuthRequest = { user?: AuthPrincipal } & Record<string, unknown>;
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    return req.user;
  },
);
