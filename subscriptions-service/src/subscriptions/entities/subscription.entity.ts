export type SubscriptionPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface SubscriptionDates {
  startsAt: Date;
  endsAt: Date;
  status: SubscriptionStatus;
}

export class SubscriptionEntity {
  id!: string;
  userId!: string;
  period!: SubscriptionPeriod;
  startsAt!: Date;
  endsAt!: Date;
  price!: string;
  currency!: string;
  status!: SubscriptionStatus;
  paymentReference: string | null = null;
  expirationNotificationSentAt: Date | null = null;
  createdAt!: Date;
}

export interface SubscriptionPrice {
  period: SubscriptionPeriod;
  price: string;
  currency: string;
}
