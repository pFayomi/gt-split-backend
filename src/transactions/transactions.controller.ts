import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get('balance/:accountNumber')
  async getBalance(@Param('accountNumber') accountNumber: string) {
    const balance = await this.transactionsService.getBalance(accountNumber);
    return { balance };
  }

  @Get('account/:accountNumber')
  async findByAccount(@Param('accountNumber') accountNumber: string) {
    return this.transactionsService.findByAccount(accountNumber);
  }

  @Post('fund')
  async fund(@Body() body: { accountNumber: string; amount: number }) {
    return this.transactionsService.fund(body.accountNumber, body.amount);
  }

  @Post('debit')
  async debit(@Body() body: any) {
    return this.transactionsService.debit(body);
  }

  @Post('credit')
  async credit(@Body() body: { accountNumber: string; amount: number; title: string; subtitle: string }) {
    return this.transactionsService.credit(body.accountNumber, body.amount, body.title, body.subtitle);
  }
}