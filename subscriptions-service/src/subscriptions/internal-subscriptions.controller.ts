import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MachineAuthGuard } from './helper/machine-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller('internal/subscriptions')
@UseGuards(MachineAuthGuard)
export class InternalSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('discount')
  getDiscount(
    @Query('userId') userId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
  ) {
    return this.subscriptions.getDiscount(
      userId,
      start ?? debut,
      end ?? fin,
    );
  }
}
