import { describe, expect, it } from 'vitest';
import { buildPoolConfig } from '../src/database/database.module';

describe('buildPoolConfig', () => {
  it('parses URL without credentials and uses DB_USER / DB_PASSWORD', () => {
    const config = buildPoolConfig({
      DB_URL: 'postgres://db:5432/parking',
      DB_USER: 'parking',
      DB_PASSWORD: 'test-password-123',
    });

    expect(config).toEqual({
      host: 'db',
      port: 5432,
      database: 'parking',
      user: 'parking',
      password: 'test-password-123',
    });
    expect((config as any).connectionString).toBeUndefined();
  });

  it('uses URL-embedded credentials as fallback when DB_USER and DB_PASSWORD are not set', () => {
    const config = buildPoolConfig({
      DATABASE_URL: 'postgres://operator:secret%40pass@remote-db:5433/subscriptions_db',
    });

    expect(config).toEqual({
      host: 'remote-db',
      port: 5433,
      database: 'subscriptions_db',
      user: 'operator',
      password: 'secret@pass',
    });
    expect((config as any).connectionString).toBeUndefined();
  });

  it('prioritizes DB_USER and DB_PASSWORD over credentials in the URL', () => {
    const config = buildPoolConfig({
      DB_URL: 'postgres://url-user:url-pass@db:5432/parking',
      DB_USER: 'env-user',
      DB_PASSWORD: 'env-password',
    });

    expect(config.user).toBe('env-user');
    expect(config.password).toBe('env-password');
  });

  it('strips jdbc: prefix correctly', () => {
    const config = buildPoolConfig({
      DB_URL: 'jdbc:postgresql://db:5432/parking',
      DB_USER: 'parking',
      DB_PASSWORD: 'pw',
    });

    expect(config.host).toBe('db');
    expect(config.port).toBe(5432);
    expect(config.database).toBe('parking');
    expect(config.user).toBe('parking');
    expect(config.password).toBe('pw');
  });

  it('defaults to port 5432 when no port is specified in the URL', () => {
    const config = buildPoolConfig({
      DB_URL: 'postgres://db/parking',
      DB_USER: 'parking',
      DB_PASSWORD: 'pw',
    });

    expect(config.port).toBe(5432);
  });
});
