import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BuildersService } from './builders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/builders')
@UseGuards(JwtAuthGuard)
export class BuildersController {
  constructor(private readonly buildersService: BuildersService) {}

  @Get('dropdown')
  async findDropdown() {
    const data = await this.buildersService.findDropdown();
    return { success: true, data };
  }

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.buildersService.findAll(query);
    // Site API returns { items, total } or similar list payload
    if (data && typeof data === 'object' && ('items' in data || 'data' in data)) {
      return { success: true, ...data };
    }
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.buildersService.findOne(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() dto: any) {
    const data = await this.buildersService.create(dto);
    return { success: true, data };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    const data = await this.buildersService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.buildersService.remove(id);
    return { success: true, data };
  }
}
