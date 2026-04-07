# The Robotics Club API

NestJS backend for a college club/society management platform.

This project implements modules for colleges, departments, events, participants, teams, members, positions, projects, blogs, certificates, and Clerk webhooks.

## Requirement Alignment

This codebase follows [requirements.md](requirements.md) with certificate behavior overridden by [pdf_generation.md](pdf_generation.md) where conflicts exist.

Implemented global rules:
- No global `/api` prefix.
- Global `ValidationPipe` with `whitelist: true` and `transform: true`.
- Unified success/error response shape via global interceptor/filters.
- Default pagination of `limit=20` and `offset=0`.
- Global rate limiting enabled with `@nestjs/throttler`.
- Extra throttling on public certificate download endpoint.

## Tech Stack

- NestJS 11
- Prisma ORM + PostgreSQL
- Clerk (dual instance auth)
- BullMQ + Redis (background certificate jobs)
- Cloudinary (certificate storage)
- PDFKit (PDF generation)

## Authentication Model

Two Clerk instances are used:
- Participant instance (`CLERK_USER_SECRET_KEY`): external users registering for events.
- Team/member instance (`CLERK_TEAM_SECRET_KEY`): club members and admins.

Primary decorators used in routes:
- `@UserAuth()` for participant-protected routes
- `@TeamMember()` for member routes
- `@TeamAdmin()` for admin-only routes
- `@UseGuards(UserOrTeamAdminGuard)` where leader/admin dual access is needed

## API Surface (Key Routes)

### Colleges
- `GET /colleges`
- `GET /colleges/:id`
- `POST /colleges` (admin)
- `PATCH /colleges/:id` (admin)
- `DELETE /colleges/:id` (admin)
- `GET /colleges/:collegeId/departments`

### Departments
- `GET /departments/:id`
- `POST /departments` (admin)
- `PATCH /departments/:id` (admin)
- `DELETE /departments/:id` (admin)

### Events
- `GET /events`
- `GET /events/:id`
- `POST /events` (admin)
- `PATCH /events/:id` (admin)
- `DELETE /events/:id` (admin)
- `POST /events/:id/schedules` (admin)
- `PATCH /events/:eventId/schedules/:scheduleId` (admin)
- `DELETE /events/:eventId/schedules/:scheduleId` (admin)
- `POST /events/:id/register` (participant, solo registration)
- `DELETE /events/:id/unregister` (participant)
- `GET /events/:id/participants`

### Participants
- `GET /participants/me`
- `POST /participants/signup`
- `PATCH /participants/me`
- `GET /participants/me/events`
- `GET /participants/:id`

Participant onboarding behavior:
- Frontend should use Clerk `publicMetadata.profileCompleted` to decide onboarding vs dashboard.
- If `profileCompleted` is not true, collect required participant details and call `POST /participants/signup`.
- Signup is kept in sync across DB and Clerk metadata: backend creates participant, then sets `publicMetadata.profileCompleted = true`; if metadata update fails, participant creation is rolled back.

### Teams
- `POST /teams` (participant)
- `GET /teams/events/:eventId` (optional `name` filter; includes leader info)
- `GET /teams/:id`
- `PATCH /teams/:id` (team leader)
- `DELETE /teams/:id` (team leader or admin)
- `PATCH /teams/:id/leader` (team leader)
- `DELETE /teams/:id/members/:participantId` (team leader)
- `POST /teams/:id/join-request` (participant)
- `GET /teams/:id/join-requests` (team leader)
- `PATCH /teams/:id/join-requests/:participantId` (team leader)

### Certificates
- `POST /certificates/bulk-generate` (admin, requirements-compatible)
- `POST /certificates/events/:eventId/generate` (admin, existing route retained)
- `POST /certificates/events/:eventId/reissue/:participantId` (admin)
- `GET /certificates/event/:eventId/participant/:collegeIdNo` (public PDF download)
- `GET /certificates/my-certificates` (participant)
- `GET /certificates/events/:eventId/my-certificate` (participant)

### Discovery
- `GET /discover/by-tags` (public)
  - Required query param: `tags` (array)
  - Optional query params: `type=blogs|projects|both`, `limit`, `offset`, `contentView`
  - Example: `/discover/by-tags?tags=ai&tags=machine-learning&type=both&limit=20&offset=0`

Additional admin utility routes are available for template management and event-scoped generation status.


### Members and Invitations
- `POST /members/invite` (admin)
- Invite creates a pending member record immediately (invitation ID as temporary ID).
- On Clerk `user.created` (team webhook), backend activates and updates the pending member record.
- On Clerk `user.updated` (team webhook), backend syncs Clerk-managed fields only (name/email/username/imageUrl).

### Webhooks
- `POST /webhooks/clerk/user`
- `POST /webhooks/clerk/team`

Supported webhook events:
- Participant webhook (`/webhooks/clerk/user`):
  - `user.created` is ignored by design.
  - `user.updated` syncs Clerk-managed fields for existing participant profiles.
- Team webhook (`/webhooks/clerk/team`):
  - `user.created` activates/updates pending invited members.
  - `user.updated` syncs Clerk-managed fields for existing members.

Secrets:
- `CLERK_USER_WEBHOOK_SECRET`
- `CLERK_TEAM_WEBHOOK_SECRET`
- Optional fallback: `CLERK_WEBHOOK_SECRET`

## Certificate Generation (pdf_generation.md precedence)

Implemented behavior:
- Admin-triggered bulk generation only.
- Generation always runs in background jobs (BullMQ worker).
- Certificates are uploaded to Cloudinary and URL is stored in `EventParticipant.certificate`.
- Reissue is allowed only when a certificate already exists.
- Participant endpoints only fetch existing certificates.
- Worker parses template placeholders before PDF generation.

Operational requirement:
- Deploy backend and worker on a persistent platform (not serverless-only execution model).

## Team Join Request Rules

Implemented rules:
- Participant must register solo first.
- Only one active `PENDING` request per participant/event.
- `REJECTED` request to same team/event cannot be recreated.
- Team leader can still approve the previously rejected request row later.
- On approval: assign `EventParticipant.teamId`, then clear participant requests for that event.

## Response Shape

Success response:

```json
{
  "success": true,
  "data": {}
}
```

Paginated response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "limit": 20,
    "offset": 0
  }
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "...",
    "details": {}
  }
}
```

## Rich Text Contract (Blogs and Projects)

- Request payloads must send `content` as a Tiptap JSON document.
- Do not send `contentHtml` in create/update requests.
- Slugs for blogs/projects are generated only in the backend from title values (not accepted from client create/update payloads).
- If a generated slug already exists, backend appends a timestamp suffix to keep it unique.
- Tags are normalized into relational tables (`tags`, `blog_tags`, `project_tags`) for efficient reuse and querying.
- `tags` table stores one canonical `tag` value per row (this `tag` is the slug value; there is no separate name/slug pair).
- Tag normalization is enforced at DB level using a PostgreSQL trigger; API also normalizes incoming values as a fallback.
- Blog/project list endpoints can be filtered by tag slugs (`tags` query param) for all users.
- Use repeated query keys to pass tag arrays in GET filters (for example: `?tags=ai&tags=machine-learning`).
- Backend converts Tiptap JSON to HTML, sanitizes it, and stores the result in `contentHtml`.
- Read endpoints support `contentView` query param to control rich payload fields: `both`, `html`, `json`, or `none`.
- Optimized defaults: list endpoints default to `html`; detail endpoints default to `both`.
- Projects support slug-based routes where useful: `GET /projects/slug/:slug`, `PATCH /projects/slug/:slug`, `DELETE /projects/slug/:slug`.
- Supported editor features include: StarterKit (paragraph, heading levels 1-4, bold, italic, strike, inline code, blockquote, horizontal rule, bullet list, ordered list, undo/redo history), underline, link (`autolink` enabled + `openOnClick` disabled), highlight (multicolor), text-style/color, subscript/superscript, text-align (paragraph + heading), CodeBlockLowlight (language-aware code blocks), images, YouTube embeds, resizable tables (row/column/cell/header operations), and nested task lists.
- Supported code block languages include: plaintext, javascript, typescript, python, java, cpp, csharp, json, html, css, bash, sql.
- Raw video/audio/file nodes are rejected; only embedded video content is allowed.
- Upload editor images as files via `POST /blogs/editor/images` or `POST /projects/editor/images` (`multipart/form-data`, field name `file`). The API stores files in Cloudinary and returns the URL.
- Returned Cloudinary asset URLs are signed.
- Cloudinary paths follow scoped folders: blog images in `blogs/<year>/...`, project images in `projects/<year>/...`, certificates in `certificates/<year>/<event_name>/<userId>.pdf` where certificate year is taken from the event schedule start year (earliest schedule year for cross-year events).
- Invalid Tiptap JSON returns a `400 Bad Request` error.

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (BullMQ queue backend)
- Valkey (application data cache backend)
- Cloudinary account

## Environment Variables

Required:

```env
DATABASE_URL=postgresql://...

CLERK_USER_SECRET_KEY=sk_...
CLERK_TEAM_SECRET_KEY=sk_...
CLERK_USER_WEBHOOK_SECRET=whsec_...
CLERK_TEAM_WEBHOOK_SECRET=whsec_...

# BullMQ queue Redis (dedicated instance)
BULLMQ_REDIS_URL=redis://...
# or BULLMQ_REDIS_HOST / BULLMQ_REDIS_PORT / BULLMQ_REDIS_USERNAME / BULLMQ_REDIS_PASSWORD

# Application cache Valkey (dedicated instance)
VALKEY_URL=redis://...
# or VALKEY_HOST / VALKEY_PORT / VALKEY_USERNAME / VALKEY_PASSWORD / VALKEY_DB

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Optional:

```env
CLERK_WEBHOOK_SECRET=whsec_... # fallback for both webhook endpoints
CLERK_MEMBER_REDIRECT_URL=https://...
PORT=3000
NODE_ENV=development
AIVEN_CA_B64=...
```

## Caching Architecture

- BullMQ uses a dedicated Redis connection via `BULLMQ_REDIS_*`.
- Application response caching uses a separate Valkey connection via `VALKEY_*`.
- Blogs and projects list/detail reads are cached in Valkey and invalidated on create/update/delete/publish/member changes.

## Local Setup

```bash
npm install
```

Run development server:

```bash
npm run start:dev
```

## Scripts

- `npm run format` - Prettier format
- `npm run lint` - ESLint (with `--fix`)
- `npm run build` - `prisma migrate deploy && prisma generate && nest build`
- `npm test` - unit tests
- `npm run test:e2e` - e2e tests
- `npm run generate:api-docs` - generate [docs/openapi.yaml](docs/openapi.yaml)

## Verification Workflow

Recommended validation sequence:

```bash
npm run format
npm run lint
npm run build
npm test
npm run generate:api-docs
```

## OpenAPI

Generated OpenAPI spec:
- [docs/openapi.yaml](docs/openapi.yaml)

Generation script:
- [src/scripts/generate-docs.ts](src/scripts/generate-docs.ts)

## Notes

- Build uses `prisma migrate deploy`; ensure `DATABASE_URL` is reachable before running build.
- Certificate download endpoint returns `application/pdf` with `Content-Disposition` header.
- Run build/lint/tests/docs generation before release.
