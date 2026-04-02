import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import { EventType } from '../../generated/prisma/client';

export class FindEventsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by event title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by event type', enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Filter team-based events' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasTeam?: boolean;

  @ApiPropertyOptional({ description: 'Filter upcoming events only' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  upcoming?: boolean;

  @ApiPropertyOptional({ description: 'Filter past events only' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  past?: boolean;
}

export class CreateEventDto {
  @ApiProperty({
    description: 'Event title',
    example: 'Robotics Workshop 2024',
  })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Event description' })
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Event type', enum: EventType })
  @IsEnum(EventType)
  eventType!: EventType;

  @ApiPropertyOptional({
    description: 'Whether this is a team-based event',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hasTeam?: boolean = false;

  @ApiPropertyOptional({
    description: 'Maximum team members (required if hasTeam is true)',
    minimum: 2,
  })
  @ValidateIf((o: CreateEventDto) => o.hasTeam === true)
  @IsInt()
  @Min(2)
  maxTeamMembers?: number;

  @ApiPropertyOptional({
    description: 'Maximum participants allowed',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiProperty({
    description: 'Registration deadline (ISO 8601 date)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString()
  registrationDeadline!: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Event title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Event type', enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Whether this is a team-based event' })
  @IsOptional()
  @IsBoolean()
  hasTeam?: boolean;

  @ApiPropertyOptional({ description: 'Maximum team members', minimum: 2 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeamMembers?: number;

  @ApiPropertyOptional({ description: 'Maximum participants', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Registration deadline (ISO 8601 date)' })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;
}

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Schedule date (ISO 8601)',
    example: '2024-12-01',
  })
  @IsDateString()
  day!: string;

  @ApiProperty({ description: 'Start time (HH:MM)', example: '09:00' })
  @IsString()
  startTime!: string;

  @ApiProperty({ description: 'End time (HH:MM)', example: '17:00' })
  @IsString()
  endTime!: string;

  @ApiProperty({ description: 'Location', example: 'Main Auditorium' })
  @IsString()
  location!: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Schedule date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  day?: string;

  @ApiPropertyOptional({ description: 'Start time (HH:MM)' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time (HH:MM)' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
