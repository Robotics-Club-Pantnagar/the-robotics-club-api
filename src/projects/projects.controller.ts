import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import {
  FindProjectsDto,
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
} from './dto';
import { TeamMember, CurrentUser } from '../auth/decorators';
import type { TeamUserPrincipal } from '../auth/types';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects with filters' })
  findAll(@Query() query: FindProjectsDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID with members' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Create a new project (Member only)' })
  create(
    @CurrentUser() user: TeamUserPrincipal,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, createProjectDto);
  }

  @Patch(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update project (Project member only)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: TeamUserPrincipal,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, updateProjectDto);
  }

  @Delete(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete project (Project creator or Admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: TeamUserPrincipal) {
    return this.projectsService.remove(id, user.id, user.role === 'admin');
  }

  @Post(':id/members')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Add member to project (Project member only)' })
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: TeamUserPrincipal,
    @Body() addProjectMemberDto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(id, user.id, addProjectMemberDto);
  }

  @Delete(':projectId/members/:memberId')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Remove member from project (Project member only)' })
  removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: TeamUserPrincipal,
  ) {
    return this.projectsService.removeMember(projectId, memberId, user.id);
  }
}
