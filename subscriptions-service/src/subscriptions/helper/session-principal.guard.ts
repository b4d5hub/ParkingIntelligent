import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

interface SessionRequest extends Request {
  user?: { userId: string; roles: string[] };
}

@Injectable()
export class SessionPrincipalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (!request.user || !/^[1-9][0-9]*$/.test(request.user.userId)) {
      throw new UnauthorizedException('Authenticated session is required.');
    }
    if (!request.user.roles.includes('CONDUCTEUR')) throw new ForbiddenException('CONDUCTEUR role is required.');
    return true;
  }
}
