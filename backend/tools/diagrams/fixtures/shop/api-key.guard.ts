import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_OPEN } from './open.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.get<boolean | undefined>(IS_OPEN, context.getHandler())) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    if (!request.headers['x-api-key']) throw new UnauthorizedException('API key required');
    return true;
  }
}
