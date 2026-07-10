import { Body, Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('api/v1/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async getAgents() {
    const data = await this.agentsService.getAgents();
    return { success: true, data };
  }

  @Get(':id')
  async getAgent(@Param('id') id: string) {
    const data = await this.agentsService.getAgentById(Number(id));
    return { success: true, data };
  }

  @Post('bulk')
  async bulkCreateAgents(@Body() body: { agents: any[] }) {
    const result = await this.agentsService.bulkCreateAgents(body.agents);
    return { success: true, count: result.count };
  }

  @Post()
  async createAgent(@Body() body: any) {
    const result = await this.agentsService.createAgent(body);
    return {
      success: true,
      isExistingAgent: result.isExistingAgent,
      existingStaff: result.existingStaff,
      data: result.agent,
    };
  }

  @Put(':id/status')
  async updateAgentStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.agentsService.updateAgentStatus(Number(id), body);
    return { success: true, data };
  }

  @Put(':id')
  async updateAgent(@Param('id') id: string, @Body() body: any) {
    const data = await this.agentsService.updateAgent(Number(id), body);
    return { success: true, data };
  }

  @Delete(':id')
  async deleteAgent(@Param('id') id: string) {
    await this.agentsService.deleteAgent(Number(id));
    return { success: true };
  }

  // ── Contact Logs ───────────────────────────────────────────────────────────
  @Post(':id/contact-log')
  async addContactLog(@Param('id') id: string, @Body() body: any) {
    const data = await this.agentsService.addContactLog(Number(id), body);
    return { success: true, data };
  }

  // ── Follow-Up CRUD ─────────────────────────────────────────────────────────
  @Post(':id/follow-ups')
  async addFollowUp(@Param('id') id: string, @Body() body: any) {
    const data = await this.agentsService.addFollowUp(Number(id), body);
    return { success: true, data };
  }

  @Put(':id/follow-ups/:followUpId')
  async updateFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() body: any,
  ) {
    const data = await this.agentsService.updateFollowUp(Number(id), Number(followUpId), body);
    return { success: true, data };
  }

  @Delete(':id/follow-ups/:followUpId')
  async deleteFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
  ) {
    const data = await this.agentsService.deleteFollowUp(Number(id), Number(followUpId));
    return { success: true, data };
  }
}
