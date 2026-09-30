import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { SplitsModule } from '../splits/splits.module';
import { SavingsModule } from '../savings/savings.module';
import { TransactionsModule } from '../transactions/transaction.module';

@Module({
  imports: [SplitsModule, SavingsModule, TransactionsModule],
  controllers: [PagesController],
})
export class PagesModule {}