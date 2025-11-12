import { type EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { ProductFactory } from './factories/product.factory.js';
import { Category } from '../category/category.entity.js';

export class ProductSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    console.log('Seeding beauty products...');
    
    const categories = await em.find(Category, {});
    if (categories.length === 0) {
      throw new Error('No categories found. Please run CategorySeeder first.');
    }

    const productsPerCategory = 2000;
    const batchSize = 100;
    let totalProductsCreated = 0;

    for (const category of categories) {
      console.log(`Creating ${productsPerCategory} products for category: ${category.name}`);
      
      for (let i = 0; i < productsPerCategory; i += batchSize) {
        const remainingProducts = Math.min(batchSize, productsPerCategory - i);
        
        await new ProductFactory(em)
          .withCategory(category)
          .create(remainingProducts);
        
        totalProductsCreated += remainingProducts;
        
        if ((i + batchSize) % 500 === 0 || i + batchSize >= productsPerCategory) {
          console.log(`  Created ${Math.min(i + batchSize, productsPerCategory)}/${productsPerCategory} products for ${category.name}`);
        }
      }
    }

    console.log(`Successfully created ${totalProductsCreated} beauty products across ${categories.length} categories`);
  }
}