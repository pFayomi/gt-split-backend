import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutosplitService } from './autosplit.service';
import { AutosplitController } from './autosplit.controller';
import { AutoSplitRule } from './auto-split-rule.entity';
import { AutoSplitProposal } from './auto-split-proposal.entity';
import { SplitsModule } from '../splits/splits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutoSplitRule, AutoSplitProposal]),
    forwardRef(() => SplitsModule),
    NotificationsModule,
    UsersModule,
  ],
  providers: [AutosplitService],
  controllers: [AutosplitController],
  exports: [AutosplitService],
})
export class AutosplitModule {}