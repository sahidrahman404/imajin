import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { type User } from '../../src/auth/user.entity.js';
import { type CartItem } from '../../src/cart/cart-item.entity.js';
import { User as UserEntity } from '../../src/auth/user.entity.js';
import { CartItem as CartItemEntity } from '../../src/cart/cart-item.entity.js';

@Entity()
export class Cart {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  user!: User;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => CartItemEntity, (cartItem) => cartItem.cart)
  items = new Collection<CartItem>(this);
}
