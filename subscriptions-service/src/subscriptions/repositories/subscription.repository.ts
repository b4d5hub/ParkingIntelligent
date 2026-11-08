import type { SubscriptionEntity, SubscriptionPeriod, SubscriptionPrice } from '../entities/subscription.entity';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const SUBSCRIPTION_PRICE_REPOSITORY = Symbol('SUBSCRIPTION_PRICE_REPOSITORY');

export class SubscriptionNotFoundError extends Error {}
export class SubscriptionPaymentConflictError extends Error {}

export interface NewSubscription {
  userId: string;
  period: SubscriptionPeriod;
  startsAt: Date;
  endsAt: Date;
  price: string;
  currency: string;
}

export interface SubscriptionRepository {
  create(input: NewSubscription): Promise<SubscriptionEntity>;
  findByUserId(userId: string): Promise<SubscriptionEntity[]>;
  findById(id: string): Promise<SubscriptionEntity | null>;
  activateAfterPayment(id: string, paymentReference: string): Promise<SubscriptionEntity>;
  expireDueSubscriptions(at: Date): Promise<number>;
  findExpiringBetween(from: Date, through: Date): Promise<SubscriptionEntity[]>;
  claimExpirationNotification(id: string, sentAt: Date): Promise<SubscriptionEntity | null>;
}

export interface SubscriptionPriceRepository {
  findActivePrice(period: SubscriptionPeriod): Promise<SubscriptionPrice | null>;
}
