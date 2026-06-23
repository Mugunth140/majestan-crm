
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
