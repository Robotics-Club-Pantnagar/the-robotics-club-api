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
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlogsService } from './blogs.service';
import {
  FindBlogsDto,
  CreateBlogDto,
  UpdateBlogDto,
  PublishBlogDto,
  BlogDataDto,
  BlogsListDataDto,
  BlogEditorImageUploadDto,
} from './dto';
import { TeamMember, CurrentUser } from '../auth/decorators';
import type { TeamUserPrincipal } from '../auth/types';
import { ContentViewQueryDto } from '../common/dto/content-view.dto';

type UploadedImageFile = {
  buffer: Buffer;
};

@ApiTags('Blogs')
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  @ApiOperation({ summary: 'List published blogs with filters' })
  @ApiOkResponse({ type: BlogsListDataDto })
  findAll(@Query() query: FindBlogsDto) {
    return this.blogsService.findAll(query);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get published blog by slug' })
  @ApiOkResponse({ type: BlogDataDto })
  findBySlug(@Param('slug') slug: string, @Query() query: ContentViewQueryDto) {
    return this.blogsService.findBySlug(slug, query.contentView ?? 'both');
  }

  @Get(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({
    summary: 'Get blog by ID (includes unpublished for author/admin)',
  })
  @ApiOkResponse({ type: BlogDataDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: TeamUserPrincipal,
    @Query() query: ContentViewQueryDto,
  ) {
    return this.blogsService.findOne(
      id,
      user.id,
      user.role === 'admin',
      query.contentView ?? 'both',
    );
  }

  @Post()
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Create a new blog post (Member only)' })
  @ApiCreatedResponse({ type: BlogDataDto })
  create(
    @CurrentUser() user: TeamUserPrincipal,
    @Body() createBlogDto: CreateBlogDto,
  ) {
    return this.blogsService.create(user.id, createBlogDto);
  }

  @Post('editor/images')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Upload blog editor image (image files only, stored in Cloudinary)',
  })
  @ApiCreatedResponse({ type: BlogEditorImageUploadDto })
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
    return this.blogsService.uploadEditorImage(file);
  }

  @Patch(':id')
  @TeamMember()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update blog post (Author or Admin only)' })
  @ApiOkResponse({ type: BlogDataDto })
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
  @ApiOkResponse({ type: BlogDataDto })
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
