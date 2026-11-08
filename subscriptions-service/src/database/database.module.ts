import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

@Global()
@Module({
  providers: [{
    provide: DATABASE_POOL,
    useFactory: () => new Pool({
      connectionString: process.env.DATABASE_URL ?? process.env.DB_URL?.replace(/^jdbc:/, ''),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    }),
  }],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
