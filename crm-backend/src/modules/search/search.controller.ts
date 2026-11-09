import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('api/v1/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly service: SearchService) {}

  /** Records matching `q`, grouped by module; `scope` keeps it to one module. */
  @Get()
  async search(@Request() req: any, @Query('q') q = '', @Query('scope') scope?: string) {
    return { success: true, data: await this.service.search(req.user, String(q), scope) };
  }

  /** The modules this user can search, for the palette's filters. */
  @Get('scopes')
  async scopes(@Request() req: any) {
    return { success: true, data: await this.service.scopesFor(req.user) };
  }
}
