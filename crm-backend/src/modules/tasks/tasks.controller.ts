import {
  Body, Controller, Delete, Get, Param, Post, Request,
  UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';

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

  // GET /api/v1/tasks/dashboard
  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    const data = await this.tasksService.getDashboard(req.user);
    return { success: true, data };
  }

  // GET /api/v1/tasks/metrics/:deptName
  @Get('metrics/:deptName')
  async getMetrics(@Param('deptName') deptName: string) {
    const data = await this.tasksService.getMetricsForDepartment(deptName);
    return { success: true, data };
  }

  // GET /api/v1/tasks
  @Get()
  async getTaskTemplates(@Request() req: any) {
    const data = await this.tasksService.getTaskTemplates(req.user);
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
  @UseInterceptors(FileInterceptor('file'))
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
  @Delete(':id')
  async deleteTaskTemplate(@Param('id') id: string, @Request() req: any) {
    const data = await this.tasksService.deleteTaskTemplate(Number(id), req.user);
    return { success: true, data };
  }
}
