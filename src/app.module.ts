import { AutosplitModule } from './autosplit/autosplit.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SplitsModule } from './splits/splits.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transaction.module';
import { SavingsModule } from './savings/savings.module';
import { PagesModule } from './pages/pages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      ...(process.env.DATABASE_URL
        ? {
            url: process.env.DATABASE_URL,
            ssl:
              process.env.DB_SSL === 'false'
                ? false
                : { rejectUnauthorized: false },
          }
        : {
            host: process.env.DB_HOST ?? 'localhost',
            port: Number(process.env.DB_PORT ?? 5436),
            username: process.env.DB_USER ?? 'postgres',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME ?? 'gt_split',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          }),
      type: 'postgres' as const,
      autoLoadEntities: true,
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    SplitsModule,
    NotificationsModule,
    TransactionsModule,
    SavingsModule,
    PagesModule,
    AutosplitModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
