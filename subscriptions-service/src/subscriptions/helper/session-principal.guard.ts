import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

interface SessionRequest extends Request {
  user?: { userId: string; roles: string[] };
}

@Injectable()
export class SessionPrincipalGuard implements CanActivate {
  private readonly logger = new Logger(SessionPrincipalGuard.name);
  private readonly authUrl = process.env.AUTH_API_URL || 'http://auth:8083';
  private readonly authUser = process.env.AUTH_SUBSCRIPTIONS_USER || 'abonnements';
  private readonly authPassword = process.env.AUTH_SUBSCRIPTIONS_PASSWORD || 'AbonnementsAuthSecret2026_uvw';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();

    if (!request.user) {
      const cookieHeader = request.headers.cookie;
      const session = this.extractCookie(cookieHeader, 'PARKING_SESSION');
      if (!session || !/^[0-9a-fA-F-]{36}$/.test(session)) {
        throw new UnauthorizedException('Authenticated session is required.');
      }

      const method = request.method;
      const csrfToken = (request.headers['x-csrf-token'] as string) || undefined;

      try {
        const credentials = Buffer.from(`${this.authUser}:${this.authPassword}`).toString('base64');
        const response = await fetch(`${this.authUrl}/internal/auth/validate-user-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
          },
          body: JSON.stringify({
            sessionCookie: session,
            httpMethod: method,
            csrfToken,
          }),
        });

        if (response.status === 401) {
          throw new UnauthorizedException('Authenticated session is required.');
        }
        if (response.status === 403) {
          throw new ForbiddenException('CSRF token is absent or invalid.');
        }
        if (!response.ok) {
          this.logger.error(`Auth validation failed with status ${response.status}`);
          throw new UnauthorizedException('Authentication service unavailable.');
        }

        const data = (await response.json()) as { user?: { userId: string; roles: string[] } };
        if (!data?.user?.userId || !Array.isArray(data?.user?.roles)) {
          throw new UnauthorizedException('Invalid user response from authentication service.');
        }

        request.user = {
          userId: String(data.user.userId),
          roles: data.user.roles,
        };
      } catch (err) {
        if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
          throw err;
        }
        this.logger.error('Failed to validate session with auth service', err);
        throw new UnauthorizedException('Authentication service unreachable.');
      }
    }

    if (!request.user || !/^[1-9][0-9]*$/.test(request.user.userId)) {
      throw new UnauthorizedException('Authenticated session is required.');
    }
    if (!request.user.roles.includes('CONDUCTEUR')) {
      throw new ForbiddenException('CONDUCTEUR role is required.');
    }
    return true;
  }

  private extractCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }
}
