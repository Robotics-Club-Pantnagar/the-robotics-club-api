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
import { CollegesService } from './colleges.service';
import { CreateCollegeDto, UpdateCollegeDto, FindCollegesDto } from './dto';
import { TeamAdmin } from '../auth/decorators';

@ApiTags('Colleges')
@Controller('colleges')
export class CollegesController {
  constructor(private readonly collegesService: CollegesService) {}

  @Get()
  @ApiOperation({ summary: 'List all colleges with pagination' })
  findAll(@Query() query: FindCollegesDto) {
    return this.collegesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get college by ID' })
  findOne(@Param('id') id: string) {
    return this.collegesService.findOne(id);
  }

  @Post()
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Create a new college (Admin only)' })
  create(@Body() createCollegeDto: CreateCollegeDto) {
    return this.collegesService.create(createCollegeDto);
  }

  @Patch(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update college (Admin only)' })
  update(@Param('id') id: string, @Body() updateCollegeDto: UpdateCollegeDto) {
    return this.collegesService.update(id, updateCollegeDto);
  }

  @Delete(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete college (Admin only)' })
  remove(@Param('id') id: string) {
    return this.collegesService.remove(id);
  }

  @Get(':collegeId/departments')
  @ApiOperation({ summary: 'List departments for a college' })
  findDepartments(@Param('collegeId') collegeId: string) {
    return this.collegesService.findDepartments(collegeId);
  }
}
