import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SessionPrincipalGuard } from './helper/session-principal.guard';
import { SubscriptionsService } from './subscriptions.service';

interface SessionRequest extends Request {
  user?: { userId: string; roles: string[] };
}

@Controller('subscriptions')
@UseGuards(SessionPrincipalGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post()
  create(@Req() request: SessionRequest, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(request.user!.userId, dto);
  }

  @Get('me')
  findMine(@Req() request: SessionRequest) {
    return this.subscriptions.findMine(request.user!.userId);
  }
}
