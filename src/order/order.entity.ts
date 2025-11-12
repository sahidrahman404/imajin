import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { type User } from '../auth/user.entity.js';
import { type OrderItem } from './order-item.entity.js';
import { User as UserEntity } from '../auth/user.entity.js';
import { OrderItem as OrderItemEntity } from './order-item.entity.js';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity()
export class Order {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  user!: User;

  @Property()
  total!: number;

  @Property({ type: 'string' })
  status: OrderStatus = OrderStatus.PENDING;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.order)
  items = new Collection<OrderItem>(this);
}
