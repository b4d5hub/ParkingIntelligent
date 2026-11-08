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
});
