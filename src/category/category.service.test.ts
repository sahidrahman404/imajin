import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { ORM } from '@/src/database.js';
import { getAllCategories } from '@/src/category/category.service.js';
import { Category } from '@/src/category/category.entity.js';
import { DatabaseSeeder } from '@/src/seeders/database.seeder.js';
import config from '@/src/mikro-orm.config.js';

describe('category service integration tests', () => {
  let orm: ORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...config,
      dbName: ':memory:',
      debug: false,
    });

    await orm.schema.refreshDatabase();
    await orm.seeder.seed(DatabaseSeeder);
  });

  afterAll(async () => {
    await orm.close();
  });

  describe('getAllCategories', () => {
    describe('basic functionality', () => {
      it('should return all categories', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        expect(Array.isArray(categories)).toBe(true);
        expect(categories.length).toBeGreaterThan(0);
      });

      it('should return categories with all required properties', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        categories.forEach((category) => {
          expect(category).toHaveProperty('id');
          expect(category).toHaveProperty('name');
          expect(category).toHaveProperty('description');
          expect(category).toHaveProperty('createdAt');
          expect(category).toHaveProperty('products');

          expect(typeof category.id).toBe('number');
          expect(typeof category.name).toBe('string');
          expect(category.createdAt).toBeInstanceOf(Date);
        });
      });

      it('should return categories with unique names', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const names = categories.map((category) => category.name);
        const uniqueNames = new Set(names);

        expect(names.length).toBe(uniqueNames.size);
      });
    });

    describe('data integrity', () => {
      it('should return all seeded beauty categories', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const expectedCategoryNames = ['skincare', 'makeup', 'hair care', 'fragrance', 'body care'];
        const returnedNames = categories.map((category) => category.name);

        expectedCategoryNames.forEach((expectedName) => {
          expect(returnedNames).toContain(expectedName);
        });

        expect(categories.length).toBe(expectedCategoryNames.length);
      });

      it('should return categories with proper descriptions', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        categories.forEach((category) => {
          expect(category.description).toBeDefined();
          expect(typeof category.description).toBe('string');
          expect(category.description!.length).toBeGreaterThan(0);
        });
      });

      it('should return categories sorted by id', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        for (let i = 1; i < categories.length; i++) {
          expect(categories[i].id).toBeGreaterThan(categories[i - 1].id);
        }
      });

      it('should maintain consistent data across multiple calls', async () => {
        const em = orm.em.fork();
        const firstCall = await getAllCategories(em);
        const secondCall = await getAllCategories(em);

        expect(firstCall.length).toBe(secondCall.length);

        firstCall.forEach((category, index) => {
          expect(category.id).toBe(secondCall[index].id);
          expect(category.name).toBe(secondCall[index].name);
          expect(category.description).toBe(secondCall[index].description);
        });
      });
    });

    describe('specific category validation', () => {
      it('should contain skincare category with correct data', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const skincareCategory = categories.find((category) => category.name === 'skincare');

        expect(skincareCategory).toBeDefined();
        expect(skincareCategory!.description).toContain('cleansers');
        expect(skincareCategory!.description).toContain('moisturizers');
        expect(skincareCategory!.description).toContain('serums');
      });

      it('should contain makeup category with correct data', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const makeupCategory = categories.find((category) => category.name === 'makeup');

        expect(makeupCategory).toBeDefined();
        expect(makeupCategory!.description).toContain('foundation');
        expect(makeupCategory!.description).toContain('lipstick');
        expect(makeupCategory!.description).toContain('eyeshadow');
      });

      it('should contain hair care category with correct data', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const hairCareCategory = categories.find((category) => category.name === 'hair care');

        expect(hairCareCategory).toBeDefined();
        expect(hairCareCategory!.description).toContain('shampoos');
        expect(hairCareCategory!.description).toContain('conditioners');
        expect(hairCareCategory!.description).toContain('styling products');
      });

      it('should contain fragrance category with correct data', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const fragranceCategory = categories.find((category) => category.name === 'fragrance');

        expect(fragranceCategory).toBeDefined();
        expect(fragranceCategory!.description).toContain('perfumes');
        expect(fragranceCategory!.description).toContain('colognes');
        expect(fragranceCategory!.description).toContain('body sprays');
      });

      it('should contain body care category with correct data', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        const bodyCareCategory = categories.find((category) => category.name === 'body care');

        expect(bodyCareCategory).toBeDefined();
        expect(bodyCareCategory!.description).toContain('body lotions');
        expect(bodyCareCategory!.description).toContain('scrubs');
        expect(bodyCareCategory!.description).toContain('bath products');
      });
    });

    describe('database operations', () => {
      it('should use correct EntityManager instance', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        expect(categories).toBeInstanceOf(Array);

        const totalCategoriesCount = await em.count(Category, {});
        expect(categories.length).toBe(totalCategoriesCount);
      });

      it('should handle multiple concurrent calls', async () => {
        const em1 = orm.em.fork();
        const em2 = orm.em.fork();
        const em3 = orm.em.fork();

        const [result1, result2, result3] = await Promise.all([
          getAllCategories(em1),
          getAllCategories(em2),
          getAllCategories(em3),
        ]);

        expect(result1.length).toBe(result2.length);
        expect(result1.length).toBe(result3.length);

        result1.forEach((category, index) => {
          expect(category.id).toBe(result2[index].id);
          expect(category.id).toBe(result3[index].id);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle fresh EntityManager instances', async () => {
        const em1 = orm.em.fork();
        const em2 = orm.em.fork();

        const categories1 = await getAllCategories(em1);
        const categories2 = await getAllCategories(em2);

        expect(categories1.length).toBe(categories2.length);
        expect(categories1.length).toBeGreaterThan(0);
      });

      it('should return categories with proper date objects', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        categories.forEach((category) => {
          expect(category.createdAt).toBeInstanceOf(Date);
          expect(category.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
        });
      });

      it('should initialize products collection', async () => {
        const em = orm.em.fork();
        const categories = await getAllCategories(em);

        categories.forEach((category) => {
          expect(category.products).toBeDefined();
        });
      });
    });
  });
});
