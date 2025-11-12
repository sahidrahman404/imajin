import { Entity, PrimaryKey, Property, OneToMany, Collection } from '@mikro-orm/core';
import { type Product } from '../../src/product/product.entity.js';
import { Product as ProductEntity } from '../../src/product/product.entity.js';

@Entity()
export class Category {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true, type: 'string' })
  name!: string;

  @Property({ nullable: true, type: 'string' })
  description?: string;

  @Property()
  createdAt: Date = new Date();

  @OneToMany(() => ProductEntity, (product) => product.category)
  products = new Collection<Product>(this);
}
