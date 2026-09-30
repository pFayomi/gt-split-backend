import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { SplitsService } from './splits.service';

@Controller('splits')
export class SplitsController {
  constructor(private splitsService: SplitsService) {}

  @Post()
  async create(@Body() body: any) {
    return this.splitsService.createSplit(body);
  }

  @Get('host/:accountNumber')
  async findByHost(@Param('accountNumber') accountNumber: string) {
    return this.splitsService.findByHost(accountNumber);
  }

  @Get('participant/:phone')
  async findByParticipant(@Param('phone') phone: string) {
    return this.splitsService.findByParticipantPhone(phone);
  }

  @Post(':splitId/participants/:participantId/remind')
  async remind(
    @Param('splitId') splitId: string,
    @Param('participantId') participantId: string,
    @Body() body: { hostName: string },
  ) {
    return this.splitsService.sendReminder(splitId, participantId, body.hostName);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.splitsService.findOne(id);
  }

  @Patch(':splitId/participants/:participantId/toggle')
  async toggleStatus(
    @Param('splitId') splitId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.splitsService.toggleParticipantStatus(splitId, participantId);
  }
}