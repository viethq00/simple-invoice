import { ApiProperty } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth.types';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid', example: 'ad1e0902-1928-4345-b513-60c86c94fc91' })
  id: string;

  @ApiProperty({ example: 'admin@simpleinvoice.test' })
  email: string;

  @ApiProperty({ example: 'Jordan Lee' })
  fullname: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token (HS256). Send as `Authorization: Bearer <token>`.',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ example: 3600, description: 'Token lifetime in seconds.' })
  expiresIn: number;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}

export function toUserProfile(user: AuthenticatedUser): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    createdAt: user.createdAt.toISOString(),
  };
}
