/*
  Warnings:

  - You are about to drop the `Blog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `College` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Department` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventSchedule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Member` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MemberPosition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Participant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Blog" DROP CONSTRAINT "Blog_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_collegeId_fkey";

-- DropForeignKey
ALTER TABLE "EventParticipant" DROP CONSTRAINT "EventParticipant_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventParticipant" DROP CONSTRAINT "EventParticipant_participantId_fkey";

-- DropForeignKey
ALTER TABLE "EventSchedule" DROP CONSTRAINT "EventSchedule_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_collegeId_fkey";

-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "MemberPosition" DROP CONSTRAINT "MemberPosition_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_collegeId_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_memberId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- DropTable
DROP TABLE "Blog";

-- DropTable
DROP TABLE "College";

-- DropTable
DROP TABLE "Department";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "EventParticipant";

-- DropTable
DROP TABLE "EventSchedule";

-- DropTable
DROP TABLE "Member";

-- DropTable
DROP TABLE "MemberPosition";

-- DropTable
DROP TABLE "Participant";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "ProjectMember";

-- CreateTable
CREATE TABLE "colleges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_schedules" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "event_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "phone" TEXT,
    "collegeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "imageUrl" TEXT,
    "githubRepo" TEXT,
    "demoUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blogs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "coverImage" TEXT,
    "authorId" TEXT NOT NULL,
    "tags" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT,
    "imageUrl" TEXT NOT NULL,
    "bio" TEXT,
    "collegeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "graduationYear" INTEGER,
    "instagram" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_positions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "year" TEXT NOT NULL,

    CONSTRAINT "member_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colleges_name_key" ON "colleges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_code_key" ON "colleges"("code");

-- CreateIndex
CREATE INDEX "departments_collegeId_idx" ON "departments"("collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_collegeId_code_key" ON "departments"("collegeId", "code");

-- CreateIndex
CREATE INDEX "events_eventType_idx" ON "events"("eventType");

-- CreateIndex
CREATE INDEX "event_schedules_eventId_idx" ON "event_schedules"("eventId");

-- CreateIndex
CREATE INDEX "event_participants_eventId_idx" ON "event_participants"("eventId");

-- CreateIndex
CREATE INDEX "event_participants_participantId_idx" ON "event_participants"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_eventId_participantId_key" ON "event_participants"("eventId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_email_key" ON "participants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "participants_username_key" ON "participants"("username");

-- CreateIndex
CREATE INDEX "participants_collegeId_idx" ON "participants"("collegeId");

-- CreateIndex
CREATE INDEX "participants_departmentId_idx" ON "participants"("departmentId");

-- CreateIndex
CREATE INDEX "projects_title_idx" ON "projects"("title");

-- CreateIndex
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");

-- CreateIndex
CREATE INDEX "project_members_memberId_idx" ON "project_members"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_memberId_key" ON "project_members"("projectId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "blogs_slug_key" ON "blogs"("slug");

-- CreateIndex
CREATE INDEX "blogs_authorId_idx" ON "blogs"("authorId");

-- CreateIndex
CREATE INDEX "blogs_published_idx" ON "blogs"("published");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "members_username_key" ON "members"("username");

-- CreateIndex
CREATE INDEX "members_collegeId_idx" ON "members"("collegeId");

-- CreateIndex
CREATE INDEX "members_departmentId_idx" ON "members"("departmentId");

-- CreateIndex
CREATE INDEX "member_positions_year_idx" ON "member_positions"("year");

-- CreateIndex
CREATE UNIQUE INDEX "member_positions_memberId_year_key" ON "member_positions"("memberId", "year");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedules" ADD CONSTRAINT "event_schedules_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
