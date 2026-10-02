import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { ErrorResponseDto } from '../common/error-response.dto';
import { AppConfig } from '../config/app-config';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { authCookieOptions } from './auth-cookie';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { LoginResponseDto, toUserProfile, UserProfileDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Verifies the credentials and returns a JWT access token. The token is also set as an ' +
      'HttpOnly, SameSite=Strict cookie for the browser app. Rate-limited per client IP and ' +
      'per account.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid email or missing password.',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Too many login attempts.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.login(dto);
    response.cookie(
      AUTH_COOKIE_NAME,
      result.accessToken,
      authCookieOptions(this.config.cookieSecure, result.expiresIn),
    );
    return result;
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('cookie')
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid or expired token.',
  })
  me(@CurrentUser() user: AuthenticatedUser): UserProfileDto {
    return toUserProfile(user);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Clears the auth cookie. Tokens are stateless JWTs: a token copied elsewhere stays valid ' +
      'until it expires.',
  })
  @ApiNoContentResponse({ description: 'Cookie cleared.' })
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions(this.config.cookieSecure));
  }
}
