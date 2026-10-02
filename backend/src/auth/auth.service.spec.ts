import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AppConfig } from '../config/app-config';
import type { User } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => {
  const actual = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');
  return {
    ...actual,
    compare: jest.fn((password: string, hash: string) => actual.compare(password, hash)),
  };
});

const SECRET = 'unit-test-secret-that-is-at-least-32-characters';

describe('AuthService', () => {
  let user: User;
  let users: jest.Mocked<Pick<UsersService, 'findByEmailWithPassword'>>;
  let jwt: JwtService;
  let service: AuthService;

  beforeAll(async () => {
    user = {
      id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
      email: 'admin@simpleinvoice.test',
      fullname: 'Jordan Lee',
      passwordHash: await bcrypt.hash('Password123!', 4),
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    };
  });

  beforeEach(() => {
    jest.mocked(bcrypt.compare).mockClear();
    users = { findByEmailWithPassword: jest.fn() };
    jwt = new JwtService({
      secret: SECRET,
      signOptions: { expiresIn: 3600, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    });
    const config = { jwt: { secret: SECRET, expiresIn: 3600 } } as AppConfig;
    service = new AuthService(users as unknown as UsersService, jwt, config);
  });

  it('issues a signed JWT for valid credentials', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);

    const result = await service.login({
      email: 'admin@simpleinvoice.test',
      password: 'Password123!',
    });

    expect(result).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        email: 'admin@simpleinvoice.test',
        fullname: 'Jordan Lee',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    const payload = await jwt.verifyAsync<{ sub: string; email: string; exp: number; iat: number }>(
      result.accessToken,
      { secret: SECRET, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    expect(payload).toMatchObject({ sub: user.id, email: user.email });
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('rejects a wrong password with a generic message', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    await expect(
      service.login({ email: 'admin@simpleinvoice.test', password: 'wrong-password' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('rejects an unknown email with the same message, still running bcrypt', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);
    await expect(
      service.login({ email: 'nobody@simpleinvoice.test', password: 'Password123!' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });
});
