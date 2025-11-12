import { Entity, PrimaryKey, Property, OneToMany, Collection } from '@mikro-orm/core';
import { type Session } from '../../src/auth/session.entity.js';
import { type Cart } from '../../src/cart/cart.entity.js';
import { type Order } from '../../src/order/order.entity.js';
import { Session as SessionEntity } from '../../src/auth/session.entity.js';
import { Cart as CartEntity } from '../../src/cart/cart.entity.js';
import { Order as OrderEntity } from '../../src/order/order.entity.js';

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true, type: 'string' })
  email!: string;

  @Property({ type: 'string' })
  password!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => SessionEntity, (session) => session.user)
  sessions = new Collection<Session>(this);

  @OneToMany(() => CartEntity, (cart) => cart.user)
  carts = new Collection<Cart>(this);

  @OneToMany(() => OrderEntity, (order) => order.user)
  orders = new Collection<Order>(this);
}
