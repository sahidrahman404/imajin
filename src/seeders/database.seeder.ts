import { type EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { CategorySeeder } from './category.seeder.js';
import { ProductSeeder } from './product.seeder.js';

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    console.log('Starting beauty marketplace database seeding...');
    console.log('This will create 5 beauty categories and 10,000 beauty products');
    
    const startTime = Date.now();
    
    await this.call(em, [
      CategorySeeder,
      ProductSeeder,
    ]);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Database seeding completed successfully in ${duration} seconds!`);
    console.log('📊 Summary:');
    console.log('  - 5 beauty categories created');
    console.log('  - 10,000 beauty products created (2,000 per category)');
  }
}