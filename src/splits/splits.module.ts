import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SplitsService } from './splits.service';
import { SplitsController } from './splits.controller';
import { Split } from './split.entity';
import { Participant } from './participant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutosplitModule } from '../autosplit/autosplit.module';
@Module({
    imports: [TypeOrmModule.forFeature([Split, Participant]), NotificationsModule, forwardRef(() => AutosplitModule)],
  providers: [SplitsService],
  controllers: [SplitsController],
  exports: [SplitsService],
})
export class SplitsModule {}