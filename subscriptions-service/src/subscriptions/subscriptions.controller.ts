import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AllowAnyRole, RequireAdmin, SessionPrincipalGuard } from './helper/session-principal.guard';
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

  @Get('plans/all')
  @RequireAdmin()
  getAllPlans() {
    return this.subscriptions.getAllPlans();
  }

  @Put('plans/:period')
  @RequireAdmin()
  updatePlan(@Param('period') period: string, @Body() dto: UpdatePlanDto) {
    return this.subscriptions.updatePlan(period, dto.price, dto.active);
  }

  @Get('admin')
  @RequireAdmin()
  findAllAdmin(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('status') status?: string,
  ) {
    let pageNum = 0;
    if (page !== undefined && page !== '') {
      pageNum = parseInt(page, 10);
      if (Number.isNaN(pageNum)) {
        throw new BadRequestException({
          code: 'INVALID_REQUEST',
          message: 'Le paramètre page doit être un entier valide.',
        });
      }
    }

    let sizeNum = 20;
    if (size !== undefined && size !== '') {
      sizeNum = parseInt(size, 10);
      if (Number.isNaN(sizeNum)) {
        throw new BadRequestException({
          code: 'INVALID_REQUEST',
          message: 'Le paramètre size doit être un entier valide.',
        });
      }
    }

    return this.subscriptions.findAllAdmin(pageNum, sizeNum, status);
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
