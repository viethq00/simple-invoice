import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SessionGuard extends AuthGuard('session') {
  override handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    if (error || !user) throw new UnauthorizedException('Sign in first');
    return user;
  }
}
