import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/validation/transforms';

const required = { message: '$property is required' };

export class LoginDto {
  @ApiProperty({ example: 'admin@simpleinvoice.test', maxLength: 254 })
  @MaxLength(254, { message: '$property must be at most $constraint1 characters' })
  @IsEmail({}, { message: '$property must be a valid email address' })
  @IsDefined(required)
  @NormalizeEmail()
  email: string;

  @ApiProperty({ example: 'Password123!', format: 'password', maxLength: 128 })
  @MaxLength(128, { message: '$property must be at most $constraint1 characters' })
  @IsNotEmpty(required)
  @IsString({ message: '$property must be text' })
  @IsDefined(required)
  password: string;
}
