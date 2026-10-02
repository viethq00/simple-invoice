import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';

@Injectable()
export class OrdersRepository {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}

  find(id: string): Promise<Order | null> {
    return this.orders.findOneBy({ id });
  }

  async saveAll(orders: Order[]): Promise<void> {
    for (const order of orders) await this.orders.save(order);
  }
}
