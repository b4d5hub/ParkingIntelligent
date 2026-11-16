import { ExecutionContext, ForbiddenException, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller';
import { SessionPrincipalGuard } from '../src/subscriptions/helper/session-principal.guard';
import type { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import type { SubscriptionEntity, SubscriptionPrice } from '../src/subscriptions/entities/subscription.entity';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: SubscriptionsService;

  beforeEach(() => {
    service = {
      create: vi.fn(async (userId: string, dto: any) => ({
        id: '10000000-0000-4000-8000-000000000001',
        userId,
        period: dto.period,
        startsAt: new Date(),
        endsAt: new Date(),
        price: '40.00',
        currency: 'MAD',
        status: 'ACTIVE',
        paymentReference: 'SIM-mock-uuid',
      }) as SubscriptionEntity),
      getPlans: vi.fn(async () => [
        { period: 'DAILY', price: '40.00', currency: 'MAD' },
        { period: 'WEEKLY', price: '180.00', currency: 'MAD' },
      ] as SubscriptionPrice[]),
      findMine: vi.fn(async (userId: string) => [
        {
          id: '10000000-0000-4000-8000-000000000001',
          userId,
          period: 'DAILY',
          status: 'ACTIVE',
        } as SubscriptionEntity,
      ]),
      cancel: vi.fn(async (id: string, userId: string) => {
        if (id === 'not-found') throw new NotFoundException('Subscription not found.');
        if (id === 'wrong-owner') throw new NotFoundException('Subscription not found.');
        if (id === 'already-cancelled') throw new ConflictException('Subscription is already cancelled.');
        if (id === 'already-expired') throw new ConflictException('Subscription is already expired.');
        return {
          id,
          userId,
          status: 'CANCELLED',
        } as SubscriptionEntity;
      }),
    } as unknown as SubscriptionsService;

    controller = new SubscriptionsController(service);
  });

  it('GET /plans returns active prices', async () => {
    const plans = await controller.getPlans();
    expect(service.getPlans).toHaveBeenCalled();
    expect(plans).toHaveLength(2);
    expect(plans[0].period).toBe('DAILY');
  });

  it('POST / creates an active subscription', async () => {
    const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
    const result = await controller.create(req, { period: 'DAILY' });
    expect(service.create).toHaveBeenCalledWith('42', { period: 'DAILY' });
    expect(result.status).toBe('ACTIVE');
    expect(result.paymentReference).toBe('SIM-mock-uuid');
  });

  it('GET /me returns user subscriptions', async () => {
    const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
    const result = await controller.findMine(req);
    expect(service.findMine).toHaveBeenCalledWith('42');
    expect(result).toHaveLength(1);
  });

  describe('POST /:id/cancel', () => {
    it('cancels active subscription for owner (200)', async () => {
      const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
      const result = await controller.cancel(req, '10000000-0000-4000-8000-000000000001');
      expect(service.cancel).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', '42');
      expect(result.status).toBe('CANCELLED');
    });

    it('returns 404 when cancelling subscription owned by another user', async () => {
      const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
      await expect(controller.cancel(req, 'wrong-owner')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 when cancelling non-existent subscription', async () => {
      const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
      await expect(controller.cancel(req, 'not-found')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 409 when cancelling already cancelled subscription', async () => {
      const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
      await expect(controller.cancel(req, 'already-cancelled')).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns 409 when cancelling expired subscription', async () => {
      const req = { user: { userId: '42', roles: ['CONDUCTEUR'] } } as any;
      await expect(controller.cancel(req, 'already-expired')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('SessionPrincipalGuard authorization checks', () => {
    let guard: SessionPrincipalGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new SessionPrincipalGuard(reflector);
    });

    function createMockContext(user: any, handler: any, isCancelOrPost = false) {
      const req: any = {
        user,
        method: isCancelOrPost ? 'POST' : 'GET',
        headers: {},
      };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
        getHandler: () => handler,
        getClass: () => SubscriptionsController,
      } as unknown as ExecutionContext;
    }

    it('allows CONDUCTEUR on cancel endpoint', async () => {
      const context = createMockContext(
        { userId: '42', roles: ['CONDUCTEUR'] },
        SubscriptionsController.prototype.cancel,
        true,
      );
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('forbids AGENT from accessing cancel endpoint (403)', async () => {
      const context = createMockContext(
        { userId: '43', roles: ['AGENT'] },
        SubscriptionsController.prototype.cancel,
        true,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('forbids AGENT from accessing findMine endpoint (403)', async () => {
      const context = createMockContext(
        { userId: '43', roles: ['AGENT'] },
        SubscriptionsController.prototype.findMine,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows AGENT (any authenticated user) on getPlans endpoint (200)', async () => {
      const context = createMockContext(
        { userId: '43', roles: ['AGENT'] },
        SubscriptionsController.prototype.getPlans,
      );
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('allows CONDUCTEUR on getPlans endpoint (200)', async () => {
      const context = createMockContext(
        { userId: '42', roles: ['CONDUCTEUR'] },
        SubscriptionsController.prototype.getPlans,
      );
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('requires authenticated session when no user is provided and no session cookie (401)', async () => {
      const context = createMockContext(
        null,
        SubscriptionsController.prototype.getPlans,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
