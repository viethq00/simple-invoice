import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, 'session') {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: 'fixture' });
  }

  validate(payload: { sub?: string }): { id: string } {
    if (!payload.sub) throw new UnauthorizedException('Token has no subject');
    return { id: payload.sub };
  }
}
