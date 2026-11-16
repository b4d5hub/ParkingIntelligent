import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SubscriptionDates, SubscriptionEntity, SubscriptionPeriod, SubscriptionPrice } from './entities/subscription.entity';
import { SYSTEM_CLOCK } from './helper/system-clock';
import {
  SUBSCRIPTION_PRICE_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionNotFoundError,
  SubscriptionPaymentConflictError,
} from './repositories/subscription.repository';
import type {
  PaginatedSubscriptions,
  SubscriptionPriceRepository,
  SubscriptionRepository,
} from './repositories/subscription.repository';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_MS = 7 * DAY_MS;

function addUtcMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(SUBSCRIPTION_PRICE_REPOSITORY) private readonly prices: SubscriptionPriceRepository,
    @Inject(SYSTEM_CLOCK) private readonly now: () => Date,
  ) {}

  async create(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    const price = await this.prices.findActivePrice(dto.period);
    if (!price) throw new ConflictException('No active price is configured for this period.');
    const currentTime = this.now();
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : currentTime;
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Invalid start date.');
    if (startsAt.getTime() < currentTime.getTime()) throw new BadRequestException('Start date cannot be in the past.');
    const paymentReference = `SIM-${randomUUID()}`;
    return this.subscriptions.create({
      userId,
      period: dto.period,
      startsAt,
      endsAt: this.calculateEndDate(startsAt, dto.period),
      price: price.price,
      currency: price.currency,
      status: 'ACTIVE',
      paymentReference,
    });
  }

  async getPlans(): Promise<SubscriptionPrice[]> {
    return this.prices.findAllActivePrices();
  }

  async getAllPlans(): Promise<SubscriptionPrice[]> {
    return this.prices.findAllPrices();
  }

  async updatePlan(period: string, price: number, active: boolean): Promise<SubscriptionPrice> {
    const validPeriods: SubscriptionPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'];
    if (!validPeriods.includes(period as SubscriptionPeriod)) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: `Période invalide : ${period}. Valeurs acceptées : DAILY, WEEKLY, MONTHLY, ANNUAL.`,
      });
    }
    if (price === undefined || price === null || price < 0 || Number.isNaN(price)) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'Le prix doit être un nombre supérieur ou égal à 0.',
      });
    }
    if (typeof active !== 'boolean') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'Le champ active doit être un booléen.',
      });
    }
    try {
      return await this.prices.updatePrice(period as SubscriptionPeriod, price.toFixed(2), active);
    } catch (err) {
      if (err instanceof SubscriptionNotFoundError) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: err.message });
      }
      throw err;
    }
  }

  async findAllAdmin(page: number, size: number, status?: string): Promise<PaginatedSubscriptions> {
    await this.subscriptions.expireDueSubscriptions(this.now());
    if (page < 0) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Le numéro de page ne peut pas être négatif.' });
    }
    if (status) {
      const validStatuses = ['ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        throw new BadRequestException({
          code: 'INVALID_REQUEST',
          message: `Statut invalide : ${status}. Valeurs acceptées : ACTIVE, PENDING_PAYMENT, EXPIRED, CANCELLED.`,
        });
      }
    }
    const effectiveSize = Math.max(1, Math.min(size || 20, 100));
    const safePage = Math.max(0, page || 0);
    return this.subscriptions.findAllPaginated(safePage, effectiveSize, status as any);
  }

  async cancel(id: string, userId: string): Promise<SubscriptionEntity> {
    await this.subscriptions.expireDueSubscriptions(this.now());
    try {
      return await this.subscriptions.cancel(id, userId);
    } catch (error) {
      if (error instanceof SubscriptionNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SubscriptionPaymentConflictError) throw new ConflictException(error.message);
      throw error;
    }
  }

  async findMine(userId: string): Promise<SubscriptionEntity[]> {
    await this.subscriptions.expireDueSubscriptions(this.now());
    return this.subscriptions.findByUserId(userId);
  }

  async confirmPayment(id: string, paymentReference: string): Promise<SubscriptionEntity> {
    if (!paymentReference.trim()) throw new BadRequestException('Payment reference is required.');
    try {
      return await this.subscriptions.activateAfterPayment(id, paymentReference);
    } catch (error) {
      if (error instanceof SubscriptionNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SubscriptionPaymentConflictError) throw new ConflictException(error.message);
      throw error;
    }
  }

  calculateEndDate(startsAt: Date, period: SubscriptionPeriod): Date {
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Invalid start date.');
    switch (period) {
      case 'DAILY': return new Date(startsAt.getTime() + DAY_MS);
      case 'WEEKLY': return new Date(startsAt.getTime() + 7 * DAY_MS);
      case 'MONTHLY': return addUtcMonthsClamped(startsAt, 1);
      case 'ANNUAL': return addUtcMonthsClamped(startsAt, 12);
    }
  }

  hasAccess(subscription: SubscriptionDates, at: Date): boolean {
    return subscription.status === 'ACTIVE'
      && at.getTime() >= subscription.startsAt.getTime()
      && at.getTime() < subscription.endsAt.getTime();
  }

  expirationNotificationIsDue(subscription: SubscriptionDates, at: Date): boolean {
    return subscription.status === 'ACTIVE'
      && at.getTime() >= subscription.endsAt.getTime() - NOTICE_MS
      && at.getTime() < subscription.endsAt.getTime();
  }

  async getDiscount(
    userId?: string,
    startStr?: string,
    endStr?: string,
  ): Promise<{ userId: string; hasActiveSubscription: boolean; discountPercentage: number }> {
    if (!userId || !userId.trim()) {
      throw new BadRequestException('userId is required');
    }
    const currentTime = this.now();
    await this.subscriptions.expireDueSubscriptions(currentTime);

    let start: Date = currentTime;
    let end: Date = currentTime;

    if (startStr) {
      start = new Date(startStr);
      if (Number.isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date');
      }
    }
    if (endStr) {
      end = new Date(endStr);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date');
      }
    }
    if (startStr && !endStr) {
      end = start;
    }
    if (!startStr && endStr) {
      start = end;
    }
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('start date must be before or equal to end date');
    }

    const hasActive = await this.subscriptions.hasActiveSubscription(userId.trim(), start, end);
    return {
      userId: userId.trim(),
      hasActiveSubscription: hasActive,
      discountPercentage: hasActive ? 100 : 0,
    };
  }
}
