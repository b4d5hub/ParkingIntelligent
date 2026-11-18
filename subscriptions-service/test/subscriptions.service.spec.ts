import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import {
  SubscriptionNotFoundError,
  SubscriptionPaymentConflictError,
} from '../src/subscriptions/repositories/subscription.repository';
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
      create: vi.fn(async (input: NewSubscription) => ({
        ...input,
        id: 'sub-1',
        status: input.status ?? 'ACTIVE',
        paymentReference: input.paymentReference ?? null,
        expirationNotificationSentAt: null,
        createdAt: now,
      }) as SubscriptionEntity),
      findByUserId: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      activateAfterPayment: vi.fn(async () => ({ id: 'sub-1', status: 'ACTIVE' }) as SubscriptionEntity),
      expireDueSubscriptions: vi.fn(async () => 0),
      findExpiringBetween: vi.fn(async () => []),
      claimExpirationNotification: vi.fn(async () => null),
      hasActiveSubscription: vi.fn(async () => false),
      cancel: vi.fn(async (id: string, userId: string) => ({
        id,
        userId,
        period: 'MONTHLY',
        startsAt: now,
        endsAt: new Date('2026-02-28T10:30:00.000Z'),
        price: '450.00',
        currency: 'MAD',
        status: 'CANCELLED',
        paymentReference: 'SIM-123',
        expirationNotificationSentAt: null,
        createdAt: now,
      }) as SubscriptionEntity),
      findAllPaginated: vi.fn(async (page: number, size: number, status?: any) => ({
        content: [],
        page,
        size,
        totalElements: 0,
        totalPages: 0,
      })),
    };
    priceRepository = {
      findActivePrice: vi.fn(async (period: SubscriptionPeriod) => ({ period, price: priceByPeriod[period], currency: 'MAD' })),
      findAllActivePrices: vi.fn(async () => [
        { period: 'DAILY', price: '40.00', currency: 'MAD' },
        { period: 'WEEKLY', price: '180.00', currency: 'MAD' },
        { period: 'MONTHLY', price: '450.00', currency: 'MAD' },
        { period: 'ANNUAL', price: '4800.00', currency: 'MAD' },
      ]),
      findAllPrices: vi.fn(async () => [
        { period: 'DAILY', price: '40.00', currency: 'MAD', active: true },
        { period: 'WEEKLY', price: '180.00', currency: 'MAD', active: false },
      ]),
      updatePrice: vi.fn(async (period: SubscriptionPeriod, price: string, active: boolean) => ({
        period,
        price,
        currency: 'MAD',
        active,
      })),
    };
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

  it('creates an active subscription directly with simulated payment reference using the server-side price', async () => {
    const created = await service.create('42', { period: 'MONTHLY' });
    expect(priceRepository.findActivePrice).toHaveBeenCalledWith('MONTHLY');
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42',
      period: 'MONTHLY',
      price: '450.00',
      currency: 'MAD',
      status: 'ACTIVE',
      paymentReference: expect.stringMatching(/^SIM-[0-9a-fA-F-]{36}$/),
      startsAt: now,
      endsAt: new Date('2026-02-28T10:30:00.000Z'),
    }));
    expect(created.status).toBe('ACTIVE');
    expect(created.paymentReference).toMatch(/^SIM-[0-9a-fA-F-]{36}$/);
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

  describe('getDiscount', () => {
    it('throws BadRequestException when userId is missing or blank', async () => {
      await expect(service.getDiscount('')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getDiscount('   ')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for invalid date inputs', async () => {
      await expect(service.getDiscount('42', 'not-a-date')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getDiscount('42', undefined, 'invalid-date')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException if start date is after end date', async () => {
      await expect(
        service.getDiscount('42', '2026-02-05T12:00:00.000Z', '2026-02-01T12:00:00.000Z'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 100% discount when an active subscription covers the window', async () => {
      vi.mocked(repository.hasActiveSubscription).mockResolvedValue(true);
      const res = await service.getDiscount(
        '42',
        '2026-02-01T10:00:00.000Z',
        '2026-02-01T12:00:00.000Z',
      );
      expect(repository.expireDueSubscriptions).toHaveBeenCalledWith(now);
      expect(repository.hasActiveSubscription).toHaveBeenCalledWith(
        '42',
        new Date('2026-02-01T10:00:00.000Z'),
        new Date('2026-02-01T12:00:00.000Z'),
      );
      expect(res).toEqual({
        userId: '42',
        hasActiveSubscription: true,
        discountPercentage: 100,
      });
    });

    it('returns 0% discount when no active subscription covers the window', async () => {
      vi.mocked(repository.hasActiveSubscription).mockResolvedValue(false);
      const res = await service.getDiscount('42');
      expect(repository.expireDueSubscriptions).toHaveBeenCalledWith(now);
      expect(repository.hasActiveSubscription).toHaveBeenCalledWith('42', now, now);
      expect(res).toEqual({
        userId: '42',
        hasActiveSubscription: false,
        discountPercentage: 0,
      });
    });
  });

  describe('getPlans', () => {
    it('returns active plans from the price repository', async () => {
      const plans = await service.getPlans();
      expect(priceRepository.findAllActivePrices).toHaveBeenCalled();
      expect(plans).toHaveLength(4);
      expect(plans[0]).toEqual({ period: 'DAILY', price: '40.00', currency: 'MAD' });
    });
  });

  describe('cancel', () => {
    it('expires due subscriptions then cancels the subscription', async () => {
      const cancelled = await service.cancel('sub-1', '42');
      expect(repository.expireDueSubscriptions).toHaveBeenCalledWith(now);
      expect(repository.cancel).toHaveBeenCalledWith('sub-1', '42');
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('maps SubscriptionNotFoundError to NotFoundException', async () => {
      vi.mocked(repository.cancel).mockRejectedValue(new SubscriptionNotFoundError('Subscription not found.'));
      await expect(service.cancel('sub-1', 'other-user')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps SubscriptionPaymentConflictError to ConflictException', async () => {
      vi.mocked(repository.cancel).mockRejectedValue(
        new SubscriptionPaymentConflictError('Subscription is already cancelled.'),
      );
      await expect(service.cancel('sub-1', '42')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('admin operations', () => {
    it('getAllPlans returns all plans', async () => {
      const plans = await service.getAllPlans();
      expect(priceRepository.findAllPrices).toHaveBeenCalled();
      expect(plans).toHaveLength(2);
    });

    it('updatePlan updates price and active status', async () => {
      const updated = await service.updatePlan('DAILY', 50, false);
      expect(priceRepository.updatePrice).toHaveBeenCalledWith('DAILY', '50.00', false);
      expect(updated.price).toBe('50.00');
    });

    it('updatePlan rejects invalid period', async () => {
      await expect(service.updatePlan('INVALID', 50, true)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updatePlan rejects negative price', async () => {
      await expect(service.updatePlan('DAILY', -5, true)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('findAllAdmin expires due subscriptions and returns paginated list', async () => {
      const result = await service.findAllAdmin(0, 20, 'ACTIVE');
      expect(repository.expireDueSubscriptions).toHaveBeenCalledWith(now);
      expect(repository.findAllPaginated).toHaveBeenCalledWith(0, 20, 'ACTIVE');
      expect(result.page).toBe(0);
    });

    it('findAllAdmin rejects invalid status', async () => {
      await expect(service.findAllAdmin(0, 20, 'INVALID_STATUS')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
