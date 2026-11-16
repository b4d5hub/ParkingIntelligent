import { Pool, type PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresSubscriptionRepository } from '../src/subscriptions/repositories/postgres-subscription.repository';

const pendingRow = {
  id: '10000000-0000-4000-8000-000000000001',
  user_id: '42',
  period: 'MONTHLY',
  starts_at: new Date('2026-04-01T00:00:00.000Z'),
  ends_at: new Date('2026-05-01T00:00:00.000Z'),
  price: '450.00',
  currency: 'MAD',
  status: 'PENDING_PAYMENT',
  payment_reference: null,
  expiration_notification_sent_at: null,
  created_at: new Date('2026-04-01T00:00:00.000Z'),
};

describe('PostgresSubscriptionRepository payment transition', () => {
  let client: PoolClient;
  let repository: PostgresSubscriptionRepository;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    repository = new PostgresSubscriptionRepository(pool);
  });

  it('changes pending to active in one transaction after payment confirmation', async () => {
    const activeRow = { ...pendingRow, status: 'ACTIVE', payment_reference: 'pay-123' };
    vi.mocked(client.query)
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [pendingRow] } as never) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [activeRow] } as never) // UPDATE
      .mockResolvedValueOnce({ rows: [] } as never); // COMMIT

    const result = await repository.activateAfterPayment(pendingRow.id, 'pay-123');
    expect(result.status).toBe('ACTIVE');
    expect(result.paymentReference).toBe('pay-123');
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('treats the same payment reference as an idempotent retry', async () => {
    const activeRow = { ...pendingRow, status: 'ACTIVE', payment_reference: 'pay-123' };
    vi.mocked(client.query)
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [activeRow] } as never) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] } as never); // COMMIT

    const result = await repository.activateAfterPayment(pendingRow.id, 'pay-123');
    expect(result.status).toBe('ACTIVE');
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(vi.mocked(client.query).mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false);
  });

  it('does not activate a subscription already in another state', async () => {
    vi.mocked(client.query)
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ ...pendingRow, status: 'CANCELLED' }] } as never) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

    await expect(repository.activateAfterPayment(pendingRow.id, 'pay-123')).rejects.toThrow('not awaiting payment');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('checks for active subscription covering requested interval', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ 1: 1 }] }) } as unknown as Pool;
    const repo = new PostgresSubscriptionRepository(pool);
    const start = new Date('2026-04-01T10:00:00.000Z');
    const end = new Date('2026-04-01T12:00:00.000Z');
    const hasActive = await repo.hasActiveSubscription('42', start, end);
    expect(hasActive).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM subscriptions'),
      ['42', start, end],
    );
  });

  it('creates an active subscription with payment reference', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          ...pendingRow,
          status: 'ACTIVE',
          payment_reference: 'SIM-test-ref',
        }],
      }),
    } as unknown as Pool;
    const repo = new PostgresSubscriptionRepository(pool);
    const result = await repo.create({
      userId: '42',
      period: 'MONTHLY',
      startsAt: pendingRow.starts_at,
      endsAt: pendingRow.ends_at,
      price: '450.00',
      currency: 'MAD',
      status: 'ACTIVE',
      paymentReference: 'SIM-test-ref',
    });
    expect(result.status).toBe('ACTIVE');
    expect(result.paymentReference).toBe('SIM-test-ref');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO subscriptions'),
      expect.arrayContaining(['42', 'MONTHLY', 'ACTIVE', 'SIM-test-ref']),
    );
  });

  it('findAllActivePrices returns active prices in catalog', async () => {
    const mockPrices = [
      { period: 'DAILY', price: '40.00', currency: 'MAD' },
      { period: 'WEEKLY', price: '180.00', currency: 'MAD' },
    ];
    const pool = { query: vi.fn().mockResolvedValue({ rows: mockPrices }) } as unknown as Pool;
    const repo = new PostgresSubscriptionRepository(pool);
    const prices = await repo.findAllActivePrices();
    expect(prices).toEqual(mockPrices);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT period, price::text AS price, currency FROM subscription_prices'),
    );
  });

  describe('cancel', () => {
    it('cancels an active subscription when requested by owner', async () => {
      const activeRow = { ...pendingRow, status: 'ACTIVE', payment_reference: 'SIM-123' };
      const cancelledRow = { ...activeRow, status: 'CANCELLED' };
      vi.mocked(client.query)
        .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
        .mockResolvedValueOnce({ rows: [activeRow] } as never) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [cancelledRow] } as never) // UPDATE
        .mockResolvedValueOnce({ rows: [] } as never); // COMMIT

      const result = await repository.cancel(pendingRow.id, '42');
      expect(result.status).toBe('CANCELLED');
      expect(client.query).toHaveBeenCalledTimes(4);
      expect(client.release).toHaveBeenCalledOnce();
    });

    it('rejects cancellation for non-uuid id', async () => {
      await expect(repository.cancel('invalid-id', '42')).rejects.toThrow('Subscription not found.');
    });

    it('rejects cancellation when subscription is not found', async () => {
      vi.mocked(client.query)
        .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
        .mockResolvedValueOnce({ rows: [] } as never) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

      await expect(repository.cancel(pendingRow.id, '42')).rejects.toThrow('Subscription not found.');
      expect(client.release).toHaveBeenCalledOnce();
    });

    it('rejects cancellation when requested by another user (returns not found)', async () => {
      const activeRow = { ...pendingRow, status: 'ACTIVE', user_id: '42' };
      vi.mocked(client.query)
        .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
        .mockResolvedValueOnce({ rows: [activeRow] } as never) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

      await expect(repository.cancel(pendingRow.id, '999')).rejects.toThrow('Subscription not found.');
      expect(client.release).toHaveBeenCalledOnce();
    });

    it('rejects cancellation when subscription is already cancelled', async () => {
      const cancelledRow = { ...pendingRow, status: 'CANCELLED', user_id: '42' };
      vi.mocked(client.query)
        .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
        .mockResolvedValueOnce({ rows: [cancelledRow] } as never) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

      await expect(repository.cancel(pendingRow.id, '42')).rejects.toThrow('already cancelled');
      expect(client.release).toHaveBeenCalledOnce();
    });

    it('rejects cancellation when subscription is expired', async () => {
      const expiredRow = { ...pendingRow, status: 'EXPIRED', user_id: '42' };
      vi.mocked(client.query)
        .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
        .mockResolvedValueOnce({ rows: [expiredRow] } as never) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

      await expect(repository.cancel(pendingRow.id, '42')).rejects.toThrow('already expired');
      expect(client.release).toHaveBeenCalledOnce();
    });
  });
});
