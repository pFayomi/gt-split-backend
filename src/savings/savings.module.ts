import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { SavingsContribution } from './savings-box.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavingsContribution, User])],
  providers: [SavingsService],
  controllers: [SavingsController],
  exports: [SavingsService],
})
export class SavingsModule {}