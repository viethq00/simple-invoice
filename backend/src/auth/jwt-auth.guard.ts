import { Injectable, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic === true || super.canActivate(context);
  }

  override handleRequest<TUser>(error: unknown, user: TUser | false, info: unknown): TUser {
    // Strategy errors (a failed user lookup) are 500s, not a 401 that logs everyone out.
    if (error instanceof Error) throw error;
    if (error || !user) {
      const expired = info instanceof Error && info.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        expired ? 'Access token has expired' : 'Authentication required',
      );
    }
    return user;
  }
}
