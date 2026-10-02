import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '../config/app-config';
import { UsersService } from '../users/users.service';
import { BCRYPT_COST } from './auth.constants';
import type { JwtPayload } from './auth.types';
import { toUserProfile, type LoginResponseDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByEmailWithPassword(email);
    // Always run bcrypt so the response time doesn't reveal whether the email exists.
    const passwordMatches = await compare(
      password,
      user?.passwordHash ?? (await this.timingDummy()),
    );
    if (!user || !passwordMatches) throw new UnauthorizedException('Invalid email or password');

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.jwt.expiresIn,
      user: toUserProfile(user),
    };
  }

  private timingDummy(): Promise<string> {
    this.dummyHash ??= hash(randomBytes(16).toString('hex'), BCRYPT_COST);
    return this.dummyHash;
  }
}
