import { type EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { CategoryFactory } from './factories/category.factory.js';

export class CategorySeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    console.log('Seeding beauty categories...');
    
    const categories = await new CategoryFactory(em).create(5);
    
    console.log(`Created ${categories.length} beauty categories`);
  }
}