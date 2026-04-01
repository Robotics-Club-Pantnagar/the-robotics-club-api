# The Robotics Club API

Backend API for a college club/society platform built with NestJS, Prisma, PostgreSQL, and Clerk.

## Overview

This API manages:
- Colleges and departments
- Events, schedules, and registrations
- Teams and team join requests
- Members and positions
- Projects and blogs
- Certificates
- Clerk webhooks for identity linking

No global /api prefix is used.

## API Documentation

Generated OpenAPI YAML:
- [docs/openapi.yaml](docs/openapi.yaml)

Regenerate docs on demand:

```bash
npm run generate:api-docs
```

The docs generator uses hash-based change detection in docs/.openapi.hash and skips writing when there are no API structure changes.

## Authentication Model

Two Clerk instances are used:
- Participant instance (external users)
- Team/member instance (club members and admins)

Guards are applied via the existing auth module and decorators.

## Team Join Request Model

Team joining is managed through a dedicated join-request table: team_join_requests.

Flow:
1. Participant registers solo for an event using POST /events/:id/register.
2. Participant requests team join using POST /teams/:id/join-request with eventId.
3. Request is stored in team_join_requests with status PENDING.
4. Team leader reviews using PATCH /teams/:id/join-requests/:participantId.
5. Approve assigns participant to team and clears join requests for that participant/event.
6. Reject marks the request REJECTED and blocks same-team re-request by the participant.

There is no EventParticipant status field in this implementation.

## Webhooks

Separate webhook endpoints are exposed:
- POST /webhooks/clerk/user
  - Participant Clerk instance webhook
  - Links Clerk user id to Participant by email
- POST /webhooks/clerk/team
  - Team/member Clerk instance webhook
  - Links Clerk user id to Member by email

Supported events:
- user.created
- user.updated

Signature verification uses Svix headers and endpoint-specific webhook secrets.

## Environment Variables

Required:
- DATABASE_URL
- CLERK_USER_SECRET_KEY
- CLERK_TEAM_SECRET_KEY
- CLERK_USER_WEBHOOK_SECRET (or CLERK_WEBHOOK_SECRET fallback)
- CLERK_TEAM_WEBHOOK_SECRET (or CLERK_WEBHOOK_SECRET fallback)

Common optional:
- CLERK_MEMBER_REDIRECT_URL
- PORT
- NODE_ENV
- AIVEN_CA_B64

## Setup

Install dependencies:

```bash
npm install
```

Apply migrations and generate Prisma client:

```bash
npx prisma migrate deploy
npx prisma generate
```

Run the development server:

```bash
npm run start:dev
```

## Scripts

- npm run start:dev
- npm run build
- npm run lint
- npm run test
- npm run generate:api-docs

## Quality and Safety

- Global validation pipe
- Global rate limiting
- Prisma and HTTP exception filters with unified error shape
- HTML sanitization for rich content fields
- Certificate endpoint throttling

## Current Verification Status

After the latest updates:
- Lint passes
- Build passes
- Tests pass
- OpenAPI generation passes
