import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { type Product } from '../../src/product/product.entity.js';
import { Product as ProductEntity } from '../../src/product/product.entity.js';
import { type Order } from '../../src/order/order.entity.js';
import { Order as OrderEntity } from '../../src/order/order.entity.js';

@Entity()
export class OrderItem {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => OrderEntity)
  order!: Order;

  @ManyToOne(() => ProductEntity)
  product!: Product;

  @Property()
  quantity!: number;

  @Property()
  price!: number;

  @Property()
  createdAt: Date = new Date();
}
