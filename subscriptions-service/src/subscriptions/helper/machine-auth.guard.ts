import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class MachineAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const expectedUser = process.env.SUBSCRIPTIONS_INTERNAL_USER || process.env.SUBSCRIPTIONS_API_USER;
    const expectedPassword = process.env.SUBSCRIPTIONS_INTERNAL_PASSWORD || process.env.SUBSCRIPTIONS_API_PASSWORD;

    if (!expectedUser || !expectedPassword) {
      throw new UnauthorizedException('Machine authentication not configured');
    }

    const base64Credentials = authHeader.slice(6).trim();
    let decoded = '';
    try {
      decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
    } catch {
      throw new UnauthorizedException('Invalid Basic authorization format');
    }

    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid Basic authorization format');
    }

    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    const userBuf = Buffer.from(user, 'utf8');
    const expectedUserBuf = Buffer.from(expectedUser, 'utf8');
    const passBuf = Buffer.from(password, 'utf8');
    const expectedPassBuf = Buffer.from(expectedPassword, 'utf8');

    const userMatches =
      userBuf.length === expectedUserBuf.length &&
      timingSafeEqual(userBuf, expectedUserBuf);
    const passMatches =
      passBuf.length === expectedPassBuf.length &&
      timingSafeEqual(passBuf, expectedPassBuf);

    if (!userMatches || !passMatches) {
      throw new UnauthorizedException('Invalid machine credentials');
    }

    return true;
  }
}
