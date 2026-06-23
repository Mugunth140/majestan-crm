
import { Controller, Get } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
