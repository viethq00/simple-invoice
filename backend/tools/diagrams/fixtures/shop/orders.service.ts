import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Order } from './order.entity';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(private readonly orders: OrdersRepository) {}

  async findOne(id: string): Promise<Order> {
    const order = await this.orders.find(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(quantities: number[]): Promise<void> {
    try {
      await this.orders.saveAll(quantities.map((quantity) => ({ id: '', quantity })));
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate')) {
        throw new ConflictException();
      }
      throw error;
    }
  }
}
