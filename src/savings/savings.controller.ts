import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SavingsService } from './savings.service';

@Controller('savings')
export class SavingsController {
  constructor(private savingsService: SavingsService) {}

  @Post('contribute')
  async contribute(@Body() body: any) {
    return this.savingsService.contribute(body);
  }

  @Get('total/:accountNumber')
  async getTotal(@Param('accountNumber') accountNumber: string) {
    const total = await this.savingsService.getTotalForAccount(accountNumber);
    return { total };
  }

  @Get('history/:accountNumber')
  async getHistory(@Param('accountNumber') accountNumber: string) {
    return this.savingsService.getHistoryForAccount(accountNumber);
  }
}