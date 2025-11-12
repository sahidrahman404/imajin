import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { type Cart } from './cart.entity.js';
import { type Product } from '../product/product.entity.js';
import { Cart as CartEntity } from './cart.entity.js';
import { Product as ProductEntity } from '../product/product.entity.js';

@Entity()
export class CartItem {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => CartEntity)
  cart!: Cart;

  @ManyToOne(() => ProductEntity)
  product!: Product;

  @Property()
  quantity!: number;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
