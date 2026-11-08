import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SubscriptionDates, SubscriptionEntity, SubscriptionPeriod } from './entities/subscription.entity';
import { SYSTEM_CLOCK } from './helper/system-clock';
import {
  SUBSCRIPTION_PRICE_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionNotFoundError,
  SubscriptionPaymentConflictError,
} from './repositories/subscription.repository';
import type {
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
    return this.subscriptions.create({
      userId,
      period: dto.period,
      startsAt,
      endsAt: this.calculateEndDate(startsAt, dto.period),
      price: price.price,
      currency: price.currency,
    });
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
}
