import type { MemberModel } from '../generated/prisma/models/Member';

export interface UserPrincipal {
  type: 'user';
  id: string;
  email?: string;
}

export interface TeamUserPrincipal {
  type: 'member';
  id: string;
  role: 'member' | 'admin';
  member?: MemberModel;
}

export type AuthPrincipal = UserPrincipal | TeamUserPrincipal;
