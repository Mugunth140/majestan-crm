
import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  async findAll() {
    const data = await this.service.findAll();
    return { success: true, data };
  }

  @Get('user/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  async forUser(@Param('id', ParseIntPipe) id: number) {
    const data = await this.service.listUserPermissions(id);
    return { success: true, data };
  }

  @Post('user/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  async setForUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { permissionKeys?: string[] },
  ) {
    const data = await this.service.setUserPermissions(id, body?.permissionKeys ?? []);
    return { success: true, data };
  }
}
