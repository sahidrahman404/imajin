import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { CartItem } from '../cart/cart-item.entity.js';
import { OrderItem } from '../order/order-item.entity.js';
import { Category } from '../category/category.entity.js';

@Entity()
export class Product {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string' })
  description?: string;

  @Property()
  price!: number;

  @ManyToOne(() => Category)
  category!: Category;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => CartItem, (cartItem) => cartItem.product)
  cartItems = new Collection<CartItem>(this);

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems = new Collection<OrderItem>(this);
}
