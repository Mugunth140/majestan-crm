import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request,
  UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // GET /api/v1/tasks/my  — must be before :id to avoid route conflict
  @Get('my')
  async getMyTasks(@Request() req: any) {
    const data = await this.tasksService.getMyTasks(req.user);
    return { success: true, data };
  }

  // GET /api/v1/tasks/board?month=YYYY-MM
  @Get('board')
  async board(@Query('month') month: string | undefined, @Request() req: any) {
    const data = await this.tasksService.board(req.user, month);
    return { success: true, data };
  }

  // GET /api/v1/tasks/setup?month=YYYY-MM — departments, people and targets to choose from
  @Get('setup')
  async setup(@Query('month') month: string | undefined, @Request() req: any) {
    const data = await this.tasksService.setup(req.user, month);
    return { success: true, data };
  }

  // POST /api/v1/tasks/copy — repeat last month's targets
  @Post('copy')
  async copy(@Body() body: any, @Request() req: any) {
    const data = await this.tasksService.copyPreviousMonth(body, req.user);
    return { success: true, data };
  }

  // GET /api/v1/tasks/metrics/:deptName
  @Get('metrics/:deptName')
  getMetrics(@Param('deptName') deptName: string) {
    const data = this.tasksService.getMetricsForDepartment(deptName);
    return { success: true, data };
  }

  // GET /api/v1/tasks?month=YYYY-MM — same as the board
  @Get()
  async getTaskTemplates(@Query('month') month: string | undefined, @Request() req: any) {
    const data = await this.tasksService.board(req.user, month);
    return { success: true, data };
  }

  // POST /api/v1/tasks
  @Post()
  async createTaskTemplate(@Body() body: any, @Request() req: any) {
    const data = await this.tasksService.createTaskTemplate(body, req.user);
    return { success: true, data };
  }

  // GET /api/v1/tasks/:id
  @Get(':id')
  async getTaskById(@Param('id') id: string, @Request() req: any) {
    const data = await this.tasksService.getTaskById(Number(id), req.user);
    return { success: true, data };
  }

  // PATCH /api/v1/tasks/:id — change targets
  @Patch(':id')
  async updateTargets(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const data = await this.tasksService.updateTargets(Number(id), body, req.user);
    return { success: true, data };
  }

  // GET /api/v1/tasks/:id/activity — what was counted
  @Get(':id/activity')
  async getActivity(@Param('id') id: string, @Request() req: any) {
    const data = await this.tasksService.getActivity(Number(id), req.user);
    return { success: true, data };
  }

  // GET /api/v1/tasks/:id/progress
  @Get(':id/progress')
  async getTaskProgress(@Param('id') id: string, @Request() req: any) {
    const data = await this.tasksService.getTaskProgress(Number(id), req.user);
    return { success: true, data };
  }

  // POST /api/v1/tasks/:id/log
  @Post(':id/log')
  async logManualProgress(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const data = await this.tasksService.logManualProgress(Number(id), body, req.user);
    return { success: true, data };
  }

  // POST /api/v1/tasks/:id/receipts
  @Post(':id/receipts')
  // Multer stops reading at 10 MB, matching the service's own check, so an
  // oversized upload is cut off instead of being buffered in memory first.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async uploadReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const data = await this.tasksService.uploadReceipt(Number(id), file, req.user);
    return { success: true, data };
  }

  // DELETE /api/v1/tasks/:id/receipts/:rid
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id/receipts/:rid')
  async deleteReceipt(
    @Param('id') id: string,
    @Param('rid') rid: string,
    @Request() req: any,
  ) {
    const data = await this.tasksService.deleteReceipt(Number(id), Number(rid), req.user);
    return { success: true, data };
  }

  // DELETE /api/v1/tasks/:id
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  async deleteTaskTemplate(@Param('id') id: string, @Request() req: any) {
    const data = await this.tasksService.deleteTaskTemplate(Number(id), req.user);
    return { success: true, data };
  }
}
