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
import { BlogsService } from './blogs.service';
import {
  FindBlogsDto,
  CreateBlogDto,
  UpdateBlogDto,
  PublishBlogDto,
} from './dto';
import { TeamMember, CurrentUser } from '../auth/decorators';
import type { TeamUserPrincipal } from '../auth/types';

@ApiTags('Blogs')
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  @ApiOperation({ summary: 'List published blogs with filters' })
  findAll(@Query() query: FindBlogsDto) {
    return this.blogsService.findAll(query);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get published blog by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.blogsService.findBySlug(slug);
  }

  @Get(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Get blog by ID (includes unpublished for author/admin)',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: TeamUserPrincipal) {
    return this.blogsService.findOne(id, user.id, user.role === 'admin');
  }

  @Post()
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Create a new blog post (Member only)' })
  create(
    @CurrentUser() user: TeamUserPrincipal,
    @Body() createBlogDto: CreateBlogDto,
  ) {
    return this.blogsService.create(user.id, createBlogDto);
  }

  @Patch(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update blog post (Author or Admin only)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: TeamUserPrincipal,
    @Body() updateBlogDto: UpdateBlogDto,
  ) {
    return this.blogsService.update(
      id,
      user.id,
      user.role === 'admin',
      updateBlogDto,
    );
  }

  @Delete(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete blog post (Author or Admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: TeamUserPrincipal) {
    return this.blogsService.remove(id, user.id, user.role === 'admin');
  }

  @Patch(':id/publish')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Publish/unpublish blog post (Author or Admin only)',
  })
  publish(
    @Param('id') id: string,
    @CurrentUser() user: TeamUserPrincipal,
    @Body() publishBlogDto: PublishBlogDto,
  ) {
    return this.blogsService.publish(
      id,
      user.id,
      user.role === 'admin',
      publishBlogDto,
    );
  }
}
