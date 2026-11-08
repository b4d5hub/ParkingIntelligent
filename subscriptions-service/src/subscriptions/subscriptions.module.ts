import { Module } from '@nestjs/common';
import { PostgresSubscriptionRepository } from './repositories/postgres-subscription.repository';
import { SUBSCRIPTION_PRICE_REPOSITORY, SUBSCRIPTION_REPOSITORY } from './repositories/subscription.repository';
import { SessionPrincipalGuard } from './helper/session-principal.guard';
import { SubscriptionExpirationJob } from './helper/subscription-expiration.job';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SYSTEM_CLOCK } from './helper/system-clock';

@Module({
  controllers: [SubscriptionsController],
  providers: [
    PostgresSubscriptionRepository,
    { provide: SUBSCRIPTION_REPOSITORY, useExisting: PostgresSubscriptionRepository },
    { provide: SUBSCRIPTION_PRICE_REPOSITORY, useExisting: PostgresSubscriptionRepository },
    { provide: SYSTEM_CLOCK, useValue: () => new Date() },
    SessionPrincipalGuard,
    SubscriptionExpirationJob,
    SubscriptionsService,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
