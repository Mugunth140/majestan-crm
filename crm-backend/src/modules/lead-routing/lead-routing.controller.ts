import { Controller, Get, Post, Param, Body, Req, Query } from '@nestjs/common';
import { LeadRoutingService } from './lead-routing.service';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { TransferFeedbackDto } from './dto/transfer-feedback.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';

@Controller('api/v1/lead-routing')
export class LeadRoutingController {
  constructor(private readonly leadRoutingService: LeadRoutingService) {}

  // ── GET /queue ─────────────────────────────────────────────────────────────
  @Get('queue')
  async getQueue(
    @Query('department') department: string = 'telecalling',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    const data = await this.leadRoutingService.getQueue(
      department,
      Number(page),
      Number(limit),
    );
    return { success: true, data };
  }

  // ── GET /history ───────────────────────────────────────────────────────────
  @Get('history')
  async getHistory(
    @Query('department') department?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('staff_id') staff_id?: string,
    @Query('event_type') event_type?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    const data = await this.leadRoutingService.getHistory({
      department,
      from_date,
      to_date,
      staff_id: staff_id ? Number(staff_id) : undefined,
      event_type,
      page: Number(page),
      limit: Number(limit),
    });
    return { success: true, data };
  }

  // ── GET /staff-list ────────────────────────────────────────────────────────
  @Get('staff-list')
  async getStaffList(@Query('department') department: string = 'telecalling') {
    const data = await this.leadRoutingService.getStaffList(department);
    return { success: true, data };
  }

  // ── POST /claim/:leadId ────────────────────────────────────────────────────
  @Post('claim/:leadId')
  async claimLead(@Param('leadId') leadId: string, @Req() req: any) {
    // TODO: add auth guard
    const user = req.user;
    const requestingUserId: number = user?.sub ?? user?.id ?? 0;
    const data = await this.leadRoutingService.claimLead(Number(leadId), requestingUserId);
    return { success: true, data };
  }

  // ── POST /assign/:leadId ───────────────────────────────────────────────────
  @Post('assign/:leadId')
  async assignLead(
    @Param('leadId') leadId: string,
    @Body() body: AssignLeadDto,
    @Req() req: any,
  ) {
    // TODO: add auth guard
    const user = req.user;
    const actionedById: number = user?.sub ?? user?.id ?? 0;
    const data = await this.leadRoutingService.assignLead(
      Number(leadId),
      body.to_user_id,
      actionedById,
      body.feedback,
    );
    return { success: true, data };
  }

  // ── POST /site-visit-complete/:leadId ──────────────────────────────────────
  @Post('site-visit-complete/:leadId')
  async siteVisitComplete(
    @Param('leadId') leadId: string,
    @Body() body: TransferFeedbackDto,
    @Req() req: any,
  ) {
    // TODO: add auth guard
    const user = req.user;
    const requestingUserId: number = user?.sub ?? user?.id ?? 0;
    await this.leadRoutingService.siteVisitComplete(
      Number(leadId),
      requestingUserId,
      body.feedback,
    );
    return { success: true };
  }

  // ── POST /rnr5-release/:leadId ─────────────────────────────────────────────
  @Post('rnr5-release/:leadId')
  async rnr5Release(
    @Param('leadId') leadId: string,
    @Body() body: TransferFeedbackDto,
    @Req() req: any,
  ) {
    // TODO: add auth guard
    const user = req.user;
    const requestingUserId: number = user?.sub ?? user?.id ?? 0;
    await this.leadRoutingService.rnr5Release(
      Number(leadId),
      requestingUserId,
      body.feedback,
    );
    return { success: true };
  }

  // ── POST /convert/:leadId ──────────────────────────────────────────────────
  @Post('convert/:leadId')
  async convertLead(
    @Param('leadId') leadId: string,
    @Body() body: ConvertLeadDto,
    @Req() req: any,
  ) {
    // TODO: add auth guard
    const user = req.user;
    const requestingUserId: number = user?.sub ?? user?.id ?? 0;
    await this.leadRoutingService.convertLead(
      Number(leadId),
      body.convert_to,
      body.feedback,
      requestingUserId,
    );
    return { success: true };
  }
}
