import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectQueryDto } from './dto/project-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(@Query() query: ProjectQueryDto) {
    const data = await this.projectsService.findAll(query);
    return { success: true, ...data };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.projectsService.findOne(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() dto: Record<string, any>) {
    const data = await this.projectsService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: Record<string, any>) {
    const data = await this.projectsService.update(id, dto);
    return { success: true, data };
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: { status: string }) {
    const data = await this.projectsService.updateStatus(id, dto.status);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.projectsService.remove(id);
    return { success: true, data };
  }
}
