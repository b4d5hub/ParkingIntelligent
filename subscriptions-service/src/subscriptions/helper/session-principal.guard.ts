import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const ALLOW_ANY_ROLE_KEY = 'allowAnyRole';
export const AllowAnyRole = () => SetMetadata(ALLOW_ANY_ROLE_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const RequireAdmin = () => SetMetadata(ROLES_KEY, ['ADMIN']);

interface SessionRequest extends Request {
  user?: { userId: string; roles: string[] };
}

@Injectable()
export class SessionPrincipalGuard implements CanActivate {
  private readonly logger = new Logger(SessionPrincipalGuard.name);
  private readonly authUrl = process.env.AUTH_API_URL || 'http://auth:8083';
  private readonly authUser = process.env.AUTH_SUBSCRIPTIONS_USER || 'abonnements';
  private readonly authPassword = process.env.AUTH_SUBSCRIPTIONS_PASSWORD || 'AbonnementsAuthSecret2026_uvw';

  constructor(private readonly reflector?: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();

    if (!request.user) {
      const cookieHeader = request.headers.cookie;
      const session = this.extractCookie(cookieHeader, 'PARKING_SESSION');
      if (!session || !/^[0-9a-fA-F-]{36}$/.test(session)) {
        throw new UnauthorizedException({
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentification requise',
        });
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
          throw new UnauthorizedException({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentification requise',
          });
        }
        if (response.status === 403) {
          throw new ForbiddenException({
            code: 'CSRF_INVALID',
            message: 'Jeton CSRF absent ou invalide',
          });
        }
        if (!response.ok) {
          this.logger.error(`Auth validation failed with status ${response.status}`);
          throw new UnauthorizedException({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentification requise',
          });
        }

        const data = (await response.json()) as { user?: { userId: string; roles: string[] } };
        if (!data?.user?.userId || !Array.isArray(data?.user?.roles)) {
          throw new UnauthorizedException({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentification requise',
          });
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
        throw new UnauthorizedException({
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentification requise',
        });
      }
    }

    if (!request.user || !/^[1-9][0-9]*$/.test(request.user.userId)) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentification requise',
      });
    }

    const requiredRoles = this.reflector?.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some((r) => request.user!.roles.includes(r));
      if (!hasRequiredRole) {
        throw new ForbiddenException({
          code: 'ACCESS_DENIED',
          message: 'Accès refusé : rôle ADMIN requis',
        });
      }
      return true;
    }

    const allowAnyRole = this.reflector?.getAllAndOverride<boolean>(ALLOW_ANY_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowAnyRole && !request.user.roles.includes('CONDUCTEUR')) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'Accès refusé : rôle CONDUCTEUR requis',
      });
    }
    return true;
  }

  private extractCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === name && v) return v;
    }
    return null;
  }
}
