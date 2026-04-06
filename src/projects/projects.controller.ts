import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  ParseFilePipeBuilder,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import {
  FindProjectsDto,
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
} from './dto';
import { TeamMember, CurrentUser } from '../auth/decorators';
import type { TeamUserPrincipal } from '../auth/types';
import { ContentViewQueryDto } from '../common/dto/content-view.dto';

type UploadedImageFile = {
  buffer: Buffer;
};

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
  findOne(@Param('id') id: string, @Query() query: ContentViewQueryDto) {
    return this.projectsService.findOne(id, query.contentView ?? 'both');
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

  @Post('editor/images')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Upload project editor image (image files only, stored in Cloudinary)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadEditorImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/,
        })
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: UploadedImageFile,
  ) {
    return this.projectsService.uploadEditorImage(file);
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
