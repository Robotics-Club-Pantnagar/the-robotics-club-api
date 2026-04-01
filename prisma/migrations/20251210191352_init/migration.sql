-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('INDUCTION', 'WORKSHOP', 'COMPETITION', 'SEMINAR', 'HACKATHON', 'MEETUP', 'OTHER');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('CHAIRPERSON', 'VICE_CHAIRPERSON', 'TREASURER', 'TECHNICAL_HEAD', 'CODING_HEAD', 'LOGISTICS_HEAD', 'EXECUTIVE_MEMBER', 'MEMBER');

-- CreateTable
CREATE TABLE "College" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSchedule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "EventSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "collegeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "imageUrl" TEXT,
    "githubUrl" TEXT,
    "demoUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blog" (
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

    CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "imageUrl" TEXT,
    "bio" TEXT,
    "collegeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "graduationYear" INTEGER,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPosition" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "year" TEXT NOT NULL,

    CONSTRAINT "MemberPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "College_name_key" ON "College"("name");

-- CreateIndex
CREATE UNIQUE INDEX "College_code_key" ON "College"("code");

-- CreateIndex
CREATE INDEX "Department_collegeId_idx" ON "Department"("collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_collegeId_code_key" ON "Department"("collegeId", "code");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "EventSchedule_eventId_idx" ON "EventSchedule"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_participantId_idx" ON "EventParticipant"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_participantId_key" ON "EventParticipant"("eventId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");

-- CreateIndex
CREATE INDEX "Participant_collegeId_idx" ON "Participant"("collegeId");

-- CreateIndex
CREATE INDEX "Participant_departmentId_idx" ON "Participant"("departmentId");

-- CreateIndex
CREATE INDEX "Project_title_idx" ON "Project"("title");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_memberId_idx" ON "ProjectMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_memberId_key" ON "ProjectMember"("projectId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Blog_slug_key" ON "Blog"("slug");

-- CreateIndex
CREATE INDEX "Blog_authorId_idx" ON "Blog"("authorId");

-- CreateIndex
CREATE INDEX "Blog_published_idx" ON "Blog"("published");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_collegeId_idx" ON "Member"("collegeId");

-- CreateIndex
CREATE INDEX "Member_departmentId_idx" ON "Member"("departmentId");

-- CreateIndex
CREATE INDEX "MemberPosition_memberId_idx" ON "MemberPosition"("memberId");

-- CreateIndex
CREATE INDEX "MemberPosition_year_idx" ON "MemberPosition"("year");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPosition_memberId_year_key" ON "MemberPosition"("memberId", "year");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSchedule" ADD CONSTRAINT "EventSchedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPosition" ADD CONSTRAINT "MemberPosition_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
