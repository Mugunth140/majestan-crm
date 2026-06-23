
import { Controller, Get } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

@Controller('api/v1/permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
