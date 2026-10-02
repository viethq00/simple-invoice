import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from '../config/app-config';
import { UsersModule } from '../users/users.module';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

export function loginAccountTracker(request: { body?: unknown }): string {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.jwt.secret,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiresIn,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          // Per IP. Named "default" so a 429 gets a plain Retry-After header.
          { name: 'default', ttl: 60_000, limit: config.loginRateLimit },
          // Per account, so switching IPs (or faking X-Forwarded-For) doesn't buy more guesses.
          {
            name: 'account',
            ttl: 60_000,
            limit: config.loginRateLimit,
            getTracker: loginAccountTracker,
          },
        ],
        errorMessage: 'Too many login attempts. Try again in a minute.',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
