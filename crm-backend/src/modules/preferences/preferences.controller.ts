import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PreferencesService } from './preferences.service';

type Req = { user: { sub: number } };

/** The signed-in user's own settings; nobody else's can be read or changed. */
@Controller('api/v1/me/preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  async list(@Request() req: Req, @Query('prefix') prefix?: string) {
    return {
      success: true,
      data: await this.preferences.list(Number(req.user.sub), prefix ?? ''),
    };
  }

  /** An empty value (null or {}) removes the setting, e.g. "Reset to default". */
  @Put(':key')
  async set(
    @Request() req: Req,
    @Param('key') key: string,
    @Body() body: { value?: unknown },
  ) {
    await this.preferences.set(Number(req.user.sub), key, body?.value);
    return { success: true };
  }
}
