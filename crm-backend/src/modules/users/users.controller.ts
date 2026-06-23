
import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
