import { Controller, ForbiddenException, Get, Header, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import { WebsiteUsersService } from './website-users.service';

@Controller('api/v1/website-users')
@UseGuards(JwtAuthGuard)
export class WebsiteUsersController {
  constructor(private readonly service: WebsiteUsersService, private readonly permissions: PermissionsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Request() req: any, @Query('search') search?: string, @Query('lead') lead?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (!(await this.permissions.hasNavModule(Number(req.user?.id), 'website-users'))) {
      throw new ForbiddenException('You do not have access to Website Users');
    }
    return { success: true, ...(await this.service.list({ search, lead, page: Number(page), limit: Number(limit) })) };
  }
}
