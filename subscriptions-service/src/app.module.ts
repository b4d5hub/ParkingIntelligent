import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, SubscriptionsModule],
})
export class AppModule {}
