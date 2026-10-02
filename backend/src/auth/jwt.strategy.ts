import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../config/app-config';
import { UsersService } from '../users/users.service';
import { AUTH_COOKIE_NAME, JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

function fromAuthCookie(request: Request): string | null {
  const token = (request.cookies as Record<string, unknown> | undefined)?.[AUTH_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfig,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromAuthCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = typeof payload.sub === 'string' ? await this.users.findById(payload.sub) : null;
    if (!user) throw new UnauthorizedException('Authentication required');
    return { id: user.id, email: user.email, fullname: user.fullname, createdAt: user.createdAt };
  }
}
