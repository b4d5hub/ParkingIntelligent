import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionExpirationJob } from '../src/subscriptions/helper/subscription-expiration.job';
import type { SubscriptionRepository } from '../src/subscriptions/repositories/subscription.repository';
import type { SubscriptionEntity } from '../src/subscriptions/entities/subscription.entity';

describe('SubscriptionExpirationJob', () => {
  const now = new Date('2026-04-01T12:00:00.000Z');
  const candidate = {
    id: 'sub-1', userId: '42', status: 'ACTIVE',
    startsAt: new Date('2026-03-01T12:00:00.000Z'),
    endsAt: new Date('2026-04-08T12:00:00.000Z'),
  } as SubscriptionEntity;
  let repository: SubscriptionRepository;
  let job: SubscriptionExpirationJob;
  let hasClaimed: boolean;

  beforeEach(() => {
    hasClaimed = false;
    repository = {
      create: vi.fn(), findByUserId: vi.fn(), findById: vi.fn(), activateAfterPayment: vi.fn(),
      expireDueSubscriptions: vi.fn(async () => 0),
      findExpiringBetween: vi.fn(async () => [candidate]),
      claimExpirationNotification: vi.fn(async () => {
        if (hasClaimed) return null;
        hasClaimed = true;
        return candidate;
      }),
    };
    job = new SubscriptionExpirationJob(repository, () => new Date(now));
  });

  it('expires due subscriptions and looks ahead seven days', async () => {
    await job.process();
    expect(repository.expireDueSubscriptions).toHaveBeenCalledWith(now);
    expect(repository.findExpiringBetween).toHaveBeenCalledWith(now, new Date('2026-04-08T12:00:00.000Z'));
  });

  it('writes one notice even when the job encounters the subscription again', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await job.process();
    await job.process();
    expect(repository.claimExpirationNotification).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('SUBSCRIPTION_EXPIRATION_NOTICE');
    log.mockRestore();
  });

  it('does not log when another job instance already claimed the notice', async () => {
    vi.mocked(repository.claimExpirationNotification).mockResolvedValue(null);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await job.process();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
