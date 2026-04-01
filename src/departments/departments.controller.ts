import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto';
import { TeamAdmin } from '../auth/decorators';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Create a new department (Admin only)' })
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Patch(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Update department (Admin only)' })
  update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Delete(':id')
  @TeamAdmin()
  @ApiBearerAuth('team-auth')
  @ApiOperation({ summary: 'Delete department (Admin only)' })
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
