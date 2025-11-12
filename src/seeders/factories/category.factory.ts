import { Factory } from '@mikro-orm/seeder';
import { Category } from '../../category/category.entity.js';

export class CategoryFactory extends Factory<Category> {
  model = Category;

  private beautyCategories = [
    {
      name: 'skincare',
      description: 'cleansers, moisturizers, serums, and treatments for all skin types',
    },
    {
      name: 'makeup',
      description: 'foundation, lipstick, eyeshadow, mascara, and other cosmetic products',
    },
    {
      name: 'hair care',
      description: 'shampoos, conditioners, styling products, and hair treatments',
    },
    {
      name: 'fragrance',
      description: 'perfumes, colognes, body sprays, and scented products',
    },
    {
      name: 'body care',
      description: 'body lotions, scrubs, bath products, and personal care items',
    },
  ];

  private categoryIndex = 0;

  definition(): Partial<Category> {
    const category = this.beautyCategories[this.categoryIndex % this.beautyCategories.length];
    this.categoryIndex++;

    return {
      name: category.name.toLowerCase(),
      description: category.description.toLowerCase(),
      createdAt: new Date(),
    };
  }
}
