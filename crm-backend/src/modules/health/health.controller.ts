
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Intentionally unauthenticated so Docker/LB probes can reach it.
 * Returns 503 via ServiceUnavailableException when any DB check fails.
 */
@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  async checkHealth() {
    const data = await this.service.checkHealth();
    return { success: true, message: 'Healthy', data };
  }
}
