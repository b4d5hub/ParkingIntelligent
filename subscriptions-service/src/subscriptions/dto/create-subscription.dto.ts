import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { SubscriptionPeriod } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'])
  period!: SubscriptionPeriod;

  @IsOptional()
  @IsDateString({ strict: true })
  startsAt?: string;
}
