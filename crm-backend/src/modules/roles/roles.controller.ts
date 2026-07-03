import { Controller, Get } from '@nestjs/common';
import { RolesService } from './roles.service';

@Controller('api/v1/roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  async findAll() {
    const data = await this.service.findAll();
    return { success: true, data };
  }
}
