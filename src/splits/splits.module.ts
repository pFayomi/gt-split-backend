import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SplitsService } from './splits.service';
import { SplitsController } from './splits.controller';
import { Split } from './split.entity';
import { Participant } from './participant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
    imports: [TypeOrmModule.forFeature([Split, Participant]), NotificationsModule],
  providers: [SplitsService],
  controllers: [SplitsController],
  exports: [SplitsService],
})
export class SplitsModule {}