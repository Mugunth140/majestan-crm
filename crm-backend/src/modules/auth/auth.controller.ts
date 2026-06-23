
import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
