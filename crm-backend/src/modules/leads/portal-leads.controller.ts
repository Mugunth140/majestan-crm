import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { MagicbricksKeyGuard, NinetyNineAcresKeyGuard } from './guards/portal-key.guard';
import { PortalLeadsDto } from './dto/portal-leads.dto';
import { PORTAL_SOURCES, PortalLeadsService } from './integrations/portal-leads.service';

@Controller('api/v1/leads/99acres')
@UseGuards(NinetyNineAcresKeyGuard)
export class NinetyNineAcresController {
  constructor(private readonly integration: PortalLeadsService) {}

  @Post() @HttpCode(200)
  receive(@Body() body: PortalLeadsDto) { return this.integration.receive(PORTAL_SOURCES.ninetyNineAcres, body); }
}

@Controller('api/v1/leads/magicbricks')
@UseGuards(MagicbricksKeyGuard)
export class MagicbricksController {
  constructor(private readonly integration: PortalLeadsService) {}

  @Post() @HttpCode(200)
  receive(@Body() body: PortalLeadsDto) { return this.integration.receive(PORTAL_SOURCES.magicbricks, body); }
}
