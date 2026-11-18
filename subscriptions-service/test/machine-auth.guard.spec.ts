import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { MachineAuthGuard } from '../src/subscriptions/helper/machine-auth.guard';

describe('MachineAuthGuard', () => {
  let guard: MachineAuthGuard;

  beforeEach(() => {
    guard = new MachineAuthGuard();
    process.env.SUBSCRIPTIONS_INTERNAL_USER = 'test-machine';
    process.env.SUBSCRIPTIONS_INTERNAL_PASSWORD = 'test-secret-123';
  });

  function createContext(authHeader?: string): ExecutionContext {
    const request = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('rejects requests without Authorization header', () => {
    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it('rejects requests with non-Basic Authorization header', () => {
    expect(() => guard.canActivate(createContext('Bearer token123'))).toThrow(UnauthorizedException);
  });

  it('rejects requests when machine auth is not configured in env', () => {
    delete process.env.SUBSCRIPTIONS_INTERNAL_USER;
    delete process.env.SUBSCRIPTIONS_API_USER;
    const creds = Buffer.from('test-machine:test-secret-123').toString('base64');
    expect(() => guard.canActivate(createContext(`Basic ${creds}`))).toThrow(UnauthorizedException);
  });

  it('rejects invalid credentials', () => {
    const creds = Buffer.from('wrong-user:wrong-pass').toString('base64');
    expect(() => guard.canActivate(createContext(`Basic ${creds}`))).toThrow(UnauthorizedException);
  });

  it('rejects malformed credentials without colon', () => {
    const creds = Buffer.from('onlyuser').toString('base64');
    expect(() => guard.canActivate(createContext(`Basic ${creds}`))).toThrow(UnauthorizedException);
  });

  it('allows valid credentials', () => {
    const creds = Buffer.from('test-machine:test-secret-123').toString('base64');
    expect(guard.canActivate(createContext(`Basic ${creds}`))).toBe(true);
  });
});
