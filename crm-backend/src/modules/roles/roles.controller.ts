
import { Controller, Get } from '@nestjs/common';
import { RolesService } from './roles.service';

@Controller('api/v1/roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
