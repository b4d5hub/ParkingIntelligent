import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SYSTEM_CLOCK } from './system-clock';
import { SUBSCRIPTION_REPOSITORY } from '../repositories/subscription.repository';
import type { SubscriptionRepository } from '../repositories/subscription.repository';

const NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionExpirationJob {
  private readonly logger = new Logger(SubscriptionExpirationJob.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(SYSTEM_CLOCK) private readonly now: () => Date,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'subscription-expiration-notices', timeZone: 'UTC' })
  async process(): Promise<void> {
    const now = this.now();
    await this.subscriptions.expireDueSubscriptions(now);

    const expiring = await this.subscriptions.findExpiringBetween(
      now,
      new Date(now.getTime() + NOTICE_WINDOW_MS),
    );

    for (const candidate of expiring) {
      const claimed = await this.subscriptions.claimExpirationNotification(candidate.id, now);
      if (!claimed) continue;

      this.logger.log(JSON.stringify({
        event: 'SUBSCRIPTION_EXPIRATION_NOTICE',
        subscriptionId: claimed.id,
        userId: claimed.userId,
        expiresAt: claimed.endsAt.toISOString(),
      }));
    }
  }
}
