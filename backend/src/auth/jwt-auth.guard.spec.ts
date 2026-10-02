import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard(new Reflector());
  const user = { id: 'u1' };

  it('returns the authenticated user', () => {
    expect(guard.handleRequest(null, user, undefined)).toBe(user);
  });

  it('rejects a missing or invalid token', () => {
    expect(() => guard.handleRequest(null, false, new Error('No auth token'))).toThrow(
      new UnauthorizedException('Authentication required'),
    );
  });

  it('tells an expired token apart', () => {
    // passport-jwt passes jsonwebtoken's TokenExpiredError as `info`.
    const info = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      new UnauthorizedException('Access token has expired'),
    );
  });

  it('keeps the 401 raised by the strategy for a deleted user', () => {
    const error = new UnauthorizedException('Authentication required');
    expect(() => guard.handleRequest(error, false, undefined)).toThrow(error);
  });

  it('does not disguise infrastructure failures as authentication failures', () => {
    const outage = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    expect(() => guard.handleRequest(outage, false, undefined)).toThrow(outage);
  });
});
