import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyGuard } from './api-key.guard';
import { Order } from './order.entity';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { SessionStrategy } from './session.strategy';

// A small app for the diagram tests: a global guard, a public route, a passport guard, pipes and
// a repository.
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    SessionStrategy,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
  exports: [OrdersService],
})
export class ShopModule {}

export function setup(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe());
}
