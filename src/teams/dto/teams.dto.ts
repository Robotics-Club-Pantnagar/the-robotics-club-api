import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ description: 'Team name', example: 'Robo Warriors' })
  @IsString()
  name!: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ description: 'Team name' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class SearchEventTeamsDto {
  @ApiPropertyOptional({
    description: 'Optional team name filter (case-insensitive partial match)',
    example: 'robo',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class JoinTeamRequestDto {
  @ApiProperty({ description: 'Event ID for this join request' })
  @IsString()
  eventId!: string;
}

export class ListJoinRequestsDto {
  @ApiPropertyOptional({
    description: 'Optional event ID filter for pending requests',
  })
  @IsOptional()
  @IsString()
  eventId?: string;
}

export enum ReviewJoinRequestAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewJoinRequestDto {
  @ApiProperty({ description: 'Event ID for this join request' })
  @IsString()
  eventId!: string;

  @ApiProperty({
    description: 'Decision for the participant join request',
    enum: ReviewJoinRequestAction,
  })
  @IsEnum(ReviewJoinRequestAction)
  action!: ReviewJoinRequestAction;
}

export class TransferLeadershipDto {
  @ApiProperty({ description: 'Participant ID to transfer leadership to' })
  @IsString()
  newLeaderId!: string;
}
