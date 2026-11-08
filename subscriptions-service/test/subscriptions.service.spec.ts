import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import type { SubscriptionRepository, SubscriptionPriceRepository } from '../src/subscriptions/repositories/subscription.repository';
import type { NewSubscription } from '../src/subscriptions/repositories/subscription.repository';
import type { SubscriptionEntity, SubscriptionPeriod } from '../src/subscriptions/entities/subscription.entity';

describe('SubscriptionsService', () => {
  const now = new Date('2026-01-31T10:30:00.000Z');
  const priceByPeriod: Record<SubscriptionPeriod, string> = {
    DAILY: '40.00', WEEKLY: '180.00', MONTHLY: '450.00', ANNUAL: '4800.00',
  };
  let repository: SubscriptionRepository;
  let priceRepository: SubscriptionPriceRepository;
  let service: SubscriptionsService;

  beforeEach(() => {
    repository = {
      create: vi.fn(async (input: NewSubscription) => ({ ...input, id: 'sub-1', status: 'PENDING_PAYMENT', paymentReference: null, expirationNotificationSentAt: null, createdAt: now }) as SubscriptionEntity),
      findByUserId: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      activateAfterPayment: vi.fn(async () => ({ id: 'sub-1', status: 'ACTIVE' }) as SubscriptionEntity),
      expireDueSubscriptions: vi.fn(async () => 0),
      findExpiringBetween: vi.fn(async () => []),
      claimExpirationNotification: vi.fn(async () => null),
    };
    priceRepository = { findActivePrice: vi.fn(async (period: SubscriptionPeriod) => ({ period, price: priceByPeriod[period], currency: 'MAD' })) };
    service = new SubscriptionsService(repository, priceRepository, () => new Date(now));
  });

  it.each([
    ['DAILY', '2026-02-01T10:30:00.000Z'],
    ['WEEKLY', '2026-02-07T10:30:00.000Z'],
    ['MONTHLY', '2026-02-28T10:30:00.000Z'],
    ['ANNUAL', '2027-01-31T10:30:00.000Z'],
  ] as const)('calculates the %s period end', (period, expected) => {
    expect(service.calculateEndDate(now, period).toISOString()).toBe(expected);
  });

  it('creates a pending subscription using the server-side period price', async () => {
    const created = await service.create('42', { period: 'MONTHLY' });
    expect(priceRepository.findActivePrice).toHaveBeenCalledWith('MONTHLY');
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42', period: 'MONTHLY', price: '450.00', currency: 'MAD',
      startsAt: now, endsAt: new Date('2026-02-28T10:30:00.000Z'),
    }));
    expect(created.status).toBe('PENDING_PAYMENT');
  });

  it('does not create a subscription if no server-side price is configured', async () => {
    vi.mocked(priceRepository.findActivePrice).mockResolvedValue(null);
    await expect(service.create('42', { period: 'DAILY' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects malformed start dates', async () => {
    await expect(service.create('42', { period: 'DAILY', startsAt: 'not-a-date' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a start date in the past', async () => {
    await expect(service.create('42', { period: 'DAILY', startsAt: '2026-01-31T10:29:59.999Z' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('activates by delegating a confirmed payment reference to the repository', async () => {
    const activated = await service.confirmPayment('sub-1', 'payment-123');
    expect(repository.activateAfterPayment).toHaveBeenCalledWith('sub-1', 'payment-123');
    expect(activated.status).toBe('ACTIVE');
  });

  it('expires ended subscriptions before returning the owner’s list', async () => {
    await service.findMine('42');
    expect(repository.expireDueSubscriptions).toHaveBeenCalledWith(now);
    expect(repository.findByUserId).toHaveBeenCalledWith('42');
    expect(vi.mocked(repository.expireDueSubscriptions).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(repository.findByUserId).mock.invocationCallOrder[0]);
  });

  it('grants access from the start instant until, but not including, the end instant', () => {
    const sub = { startsAt: now, endsAt: new Date('2026-02-01T10:30:00.000Z'), status: 'ACTIVE' as const };
    expect(service.hasAccess(sub, new Date(now.getTime() - 1))).toBe(false);
    expect(service.hasAccess(sub, now)).toBe(true);
    expect(service.hasAccess(sub, sub.endsAt)).toBe(false);
  });

  it.each(['PENDING_PAYMENT', 'EXPIRED', 'CANCELLED'] as const)('denies access to a %s subscription', status => {
    const sub = { startsAt: now, endsAt: new Date('2026-02-01T10:30:00.000Z'), status };
    expect(service.hasAccess(sub, now)).toBe(false);
  });

  it('makes the expiration notice due from seven days before expiry until expiry', () => {
    const sub = { startsAt: now, endsAt: new Date('2026-02-28T10:30:00.000Z'), status: 'ACTIVE' as const };
    const threshold = new Date(sub.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(service.expirationNotificationIsDue(sub, new Date(threshold.getTime() - 1))).toBe(false);
    expect(service.expirationNotificationIsDue(sub, threshold)).toBe(true);
    expect(service.expirationNotificationIsDue(sub, sub.endsAt)).toBe(false);
  });

  it('requires a payment reference before requesting activation', async () => {
    await expect(service.confirmPayment('sub-1', '  ')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.activateAfterPayment).not.toHaveBeenCalled();
  });
});
