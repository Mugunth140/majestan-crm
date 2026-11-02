import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { NinetyNineAcresKeyGuard } from './guards/ninety-nine-acres-key.guard';
import { NinetyNineAcresLeadsDto } from './dto/ninety-nine-acres-leads.dto';
import { NinetyNineAcresService } from './integrations/ninety-nine-acres.service';

@Controller('api/v1/leads/99acres')
@UseGuards(NinetyNineAcresKeyGuard)
export class NinetyNineAcresController {
  constructor(private readonly integration: NinetyNineAcresService) {}

  @Post() @HttpCode(200)
  receive(@Body() body: NinetyNineAcresLeadsDto) { return this.integration.receive(body); }
}
