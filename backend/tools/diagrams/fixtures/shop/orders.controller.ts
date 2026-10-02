import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Open } from './open.decorator';
import type { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { SessionGuard } from './session.guard';

export class CreateOrderDto {
  quantities: number[];
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.orders.findOne(id);
  }

  @Open()
  @Post()
  create(@Body() dto: CreateOrderDto): Promise<void> {
    return this.orders.create(dto.quantities);
  }

  // Signed in with passport instead of the API key.
  @Open()
  @UseGuards(SessionGuard)
  @Get('mine')
  mine(): Order[] {
    return [];
  }

  // A guard made by a call and a generic pipe, neither of which is a plain class name.
  @Open()
  @UseGuards(AuthGuard('session'))
  @Get('recent')
  recent(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number): Order[] {
    return Array.from({ length: limit });
  }
}
