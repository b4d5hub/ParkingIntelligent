import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AllowAnyRole, SessionPrincipalGuard } from './helper/session-principal.guard';
import { SubscriptionsService } from './subscriptions.service';

interface SessionRequest extends Request {
  user?: { userId: string; roles: string[] };
}

@Controller('subscriptions')
@UseGuards(SessionPrincipalGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  @AllowAnyRole()
  getPlans() {
    return this.subscriptions.getPlans();
  }

  @Post()
  create(@Req() request: SessionRequest, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(request.user!.userId, dto);
  }

  @Get('me')
  findMine(@Req() request: SessionRequest) {
    return this.subscriptions.findMine(request.user!.userId);
  }

  @Post(':id/cancel')
  cancel(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.subscriptions.cancel(id, request.user!.userId);
  }
}
