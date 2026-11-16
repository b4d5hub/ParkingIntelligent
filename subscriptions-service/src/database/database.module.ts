import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { buildPoolConfig, DATABASE_POOL } from './database.config';

export { buildPoolConfig, DATABASE_POOL };

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => new Pool(buildPoolConfig()),
    },
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
