import { IsString, IsInt, IsPositive, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../../generated/prisma/client';

export class CreateParticipantDto {
  @ApiProperty({ description: 'College ID' })
  @IsString()
  collegeId!: string;

  @ApiProperty({ description: 'Department ID' })
  @IsString()
  departmentId!: string;

  @ApiProperty({
    description: 'College ID number (roll number)',
    example: 12345,
  })
  @IsInt()
  @IsPositive()
  collegeIdNo!: number;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Academic year', example: '3rd Year' })
  @IsOptional()
  @IsString()
  year?: string;
}

export class UpdateParticipantDto {
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'College ID' })
  @IsOptional()
  @IsString()
  collegeId?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'College ID number (roll number)',
    example: 12345,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  collegeIdNo?: number;

  @ApiPropertyOptional({ description: 'Academic year' })
  @IsOptional()
  @IsString()
  year?: string;
}

export class ParticipantCollegeDto {
  @ApiProperty({ description: 'College ID' })
  id!: string;

  @ApiProperty({ description: 'College name' })
  name!: string;

  @ApiProperty({ description: 'College code' })
  code!: string;

  @ApiPropertyOptional({ description: 'College location' })
  location?: string;
}

export class ParticipantDepartmentDto {
  @ApiProperty({ description: 'Department ID' })
  id!: string;

  @ApiProperty({ description: 'Department name' })
  name!: string;

  @ApiProperty({ description: 'Department code' })
  code!: string;

  @ApiProperty({ description: 'College ID this department belongs to' })
  collegeId!: string;
}

export class ParticipantProfileDto {
  @ApiProperty({ description: 'Participant ID (Clerk user ID)' })
  id!: string;

  @ApiProperty({ description: 'Full name' })
  name!: string;

  @ApiProperty({ description: 'Email address' })
  email!: string;

  @ApiProperty({ description: 'Username' })
  username!: string;

  @ApiProperty({ description: 'Profile image URL' })
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string;

  @ApiProperty({ description: 'College ID' })
  collegeId!: string;

  @ApiProperty({ description: 'Department ID' })
  departmentId!: string;

  @ApiProperty({ description: 'College ID number (roll number)' })
  collegeIdNo!: number;

  @ApiPropertyOptional({ description: 'Academic year' })
  year?: string;

  @ApiProperty({
    description: 'Profile creation timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({ type: ParticipantCollegeDto })
  college!: ParticipantCollegeDto;

  @ApiProperty({ type: ParticipantDepartmentDto })
  department!: ParticipantDepartmentDto;
}

export class ParticipantEventScheduleDto {
  @ApiProperty({ description: 'Schedule ID' })
  id!: string;

  @ApiProperty({ description: 'Event ID' })
  eventId!: string;

  @ApiProperty({
    description: 'Schedule date',
    example: '2026-02-10T00:00:00.000Z',
  })
  day!: string;

  @ApiProperty({ description: 'Schedule start time', example: '10:00' })
  startTime!: string;

  @ApiProperty({ description: 'Schedule end time', example: '12:00' })
  endTime!: string;

  @ApiProperty({ description: 'Event location' })
  location!: string;

  @ApiPropertyOptional({ description: 'Optional schedule notes' })
  notes?: string;
}

export class ParticipantEventDto {
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @ApiProperty({ description: 'Event title' })
  title!: string;

  @ApiProperty({ description: 'Event description' })
  description!: string;

  @ApiProperty({ description: 'Event type', enum: EventType })
  eventType!: EventType;

  @ApiProperty({ description: 'Whether this is a team event' })
  hasTeam!: boolean;

  @ApiPropertyOptional({ description: 'Maximum team members if team event' })
  maxTeamMembers?: number;

  @ApiPropertyOptional({ description: 'Maximum participant capacity' })
  maxParticipants?: number;

  @ApiProperty({
    description: 'Registration deadline',
    example: '2026-02-01T23:59:59.000Z',
  })
  registrationDeadline!: string;

  @ApiPropertyOptional({ description: 'Optional event certificate template' })
  certificateTemplate?: string;

  @ApiProperty({
    description: 'Event creation timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Event last updated timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({ type: [ParticipantEventScheduleDto] })
  schedule!: ParticipantEventScheduleDto[];
}

export class ParticipantTeamDto {
  @ApiProperty({ description: 'Team ID' })
  id!: string;

  @ApiProperty({ description: 'Team name' })
  name!: string;

  @ApiProperty({ description: 'Team leader participant ID' })
  leaderId!: string;

  @ApiProperty({
    description: 'Team creation timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  createdAt!: string;
}

export class ParticipantRegisteredEventDto {
  @ApiProperty({ description: 'Event registration ID' })
  id!: string;

  @ApiProperty({ description: 'Event ID' })
  eventId!: string;

  @ApiProperty({ description: 'Participant ID' })
  participantId!: string;

  @ApiPropertyOptional({ description: 'Team ID if registered as team' })
  teamId?: string;

  @ApiPropertyOptional({ description: 'Certificate URL if available' })
  certificate?: string;

  @ApiProperty({
    description: 'Registration timestamp',
    example: '2026-01-01T10:00:00.000Z',
  })
  registeredAt!: string;

  @ApiProperty({ type: ParticipantEventDto })
  event!: ParticipantEventDto;

  @ApiPropertyOptional({ type: ParticipantTeamDto })
  team?: ParticipantTeamDto;
}
