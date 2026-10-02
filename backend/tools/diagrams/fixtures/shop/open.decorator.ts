import { SetMetadata } from '@nestjs/common';

export const IS_OPEN = 'isOpen';

export const Open = (): MethodDecorator & ClassDecorator => SetMetadata(IS_OPEN, true);
