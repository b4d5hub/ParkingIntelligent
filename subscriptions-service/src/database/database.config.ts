import type { PoolConfig } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

export function buildPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const rawUrl = env.DATABASE_URL ?? env.DB_URL;
  let host: string | undefined;
  let port = 5432;
  let database: string | undefined;
  let urlUser: string | undefined;
  let urlPassword: string | undefined;

  if (rawUrl) {
    const cleanUrl = rawUrl.replace(/^jdbc:/, '');
    const parsed = new URL(cleanUrl);
    host = parsed.hostname || undefined;
    if (parsed.port) {
      const parsedPort = Number(parsed.port);
      if (!Number.isNaN(parsedPort)) {
        port = parsedPort;
      }
    }
    if (parsed.pathname && parsed.pathname.length > 1) {
      database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    }
    if (parsed.username) {
      urlUser = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      urlPassword = decodeURIComponent(parsed.password);
    }
  }

  if (!host && env.DB_HOST) {
    host = env.DB_HOST;
  }
  if (!database && (env.DB_NAME ?? env.POSTGRES_DB)) {
    database = env.DB_NAME ?? env.POSTGRES_DB;
  }

  const user = env.DB_USER || urlUser;
  const password = env.DB_PASSWORD || urlPassword;

  return {
    host,
    port,
    database,
    user,
    password,
  };
}
