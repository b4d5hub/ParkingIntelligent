import { Inject, Injectable } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';
import { SubscriptionEntity } from '../entities/subscription.entity';
import type { SubscriptionPeriod, SubscriptionPrice } from '../entities/subscription.entity';
import { SubscriptionNotFoundError, SubscriptionPaymentConflictError } from './subscription.repository';
import type { NewSubscription, SubscriptionPriceRepository, SubscriptionRepository } from './subscription.repository';

interface SubscriptionRow extends QueryResultRow {
  id: string; user_id: string; period: SubscriptionPeriod; starts_at: Date; ends_at: Date;
  price: string; currency: string; status: SubscriptionEntity['status']; payment_reference: string | null;
  expiration_notification_sent_at: Date | null; created_at: Date;
}

function mapEntity(row: SubscriptionRow): SubscriptionEntity {
  return Object.assign(new SubscriptionEntity(), {
    id: row.id,
    userId: row.user_id,
    period: row.period,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    price: row.price,
    currency: row.currency,
    status: row.status,
    paymentReference: row.payment_reference,
    expirationNotificationSentAt: row.expiration_notification_sent_at,
    createdAt: row.created_at,
  });
}

@Injectable()
export class PostgresSubscriptionRepository implements SubscriptionRepository, SubscriptionPriceRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: NewSubscription): Promise<SubscriptionEntity> {
    const { rows } = await this.pool.query<SubscriptionRow>(
      `INSERT INTO subscriptions (user_id, period, starts_at, ends_at, price, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_PAYMENT') RETURNING *`,
      [input.userId, input.period, input.startsAt, input.endsAt, input.price, input.currency],
    );
    return mapEntity(rows[0]);
  }

  async findByUserId(userId: string): Promise<SubscriptionEntity[]> {
    const { rows } = await this.pool.query<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [userId],
    );
    return rows.map(mapEntity);
  }

  async findById(id: string): Promise<SubscriptionEntity | null> {
    const { rows } = await this.pool.query<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE id = $1', [id],
    );
    return rows[0] ? mapEntity(rows[0]) : null;
  }

  async activateAfterPayment(id: string, paymentReference: string): Promise<SubscriptionEntity> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<SubscriptionRow>(
        'SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [id],
      );
      if (!rows[0]) throw new SubscriptionNotFoundError('Subscription not found.');
      const current = mapEntity(rows[0]);
      if (current.status === 'ACTIVE' && current.paymentReference === paymentReference) {
        await client.query('COMMIT');
        return current;
      }
      if (current.status !== 'PENDING_PAYMENT') throw new SubscriptionPaymentConflictError('Subscription is not awaiting payment.');
      const { rows: updated } = await client.query<SubscriptionRow>(
        `UPDATE subscriptions SET status = 'ACTIVE', payment_reference = $2
         WHERE id = $1 RETURNING *`, [id, paymentReference],
      );
      await client.query('COMMIT');
      return mapEntity(updated[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async expireDueSubscriptions(at: Date): Promise<number> {
    const result = await this.pool.query(
      `UPDATE subscriptions SET status = 'EXPIRED'
       WHERE status = 'ACTIVE' AND ends_at <= $1`, [at],
    );
    return result.rowCount ?? 0;
  }

  async findExpiringBetween(from: Date, through: Date): Promise<SubscriptionEntity[]> {
    const { rows } = await this.pool.query<SubscriptionRow>(
      `SELECT * FROM subscriptions
       WHERE status = 'ACTIVE' AND expiration_notification_sent_at IS NULL
         AND ends_at > $1 AND ends_at <= $2
       ORDER BY ends_at, id LIMIT 1000`, [from, through],
    );
    return rows.map(mapEntity);
  }

  async claimExpirationNotification(id: string, sentAt: Date): Promise<SubscriptionEntity | null> {
    const through = new Date(sentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { rows } = await this.pool.query<SubscriptionRow>(
      `UPDATE subscriptions SET expiration_notification_sent_at = $2
       WHERE id = $1 AND status = 'ACTIVE'
         AND expiration_notification_sent_at IS NULL
         AND ends_at > $2 AND ends_at <= $3
       RETURNING *`, [id, sentAt, through],
    );
    return rows[0] ? mapEntity(rows[0]) : null;
  }

  async findActivePrice(period: SubscriptionPeriod): Promise<SubscriptionPrice | null> {
    const { rows } = await this.pool.query<{ period: SubscriptionPeriod; price: string; currency: string }>(
      `SELECT period, price::text AS price, currency FROM subscription_prices
       WHERE period = $1 AND active = TRUE`, [period],
    );
    return rows[0] ?? null;
  }
}
