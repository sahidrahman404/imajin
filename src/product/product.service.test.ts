import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { ORM } from '../database.js';
import { searchProducts } from './product.service.js';
import { Product } from './product.entity.js';
import { Category } from '../category/category.entity.js';
import { DatabaseSeeder } from '../seeders/database.seeder.js';
import config from '../mikro-orm.config.js';

describe('product service integration tests', () => {
  let orm: ORM;
  let categories: Category[];

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...config,
      dbName: ':memory:',
      debug: false,
    });

    await orm.schema.refreshDatabase();
    await orm.seeder.seed(DatabaseSeeder);

    const em = orm.em.fork();
    categories = await em.find(Category, {});
  });

  afterAll(async () => {
    await orm.close();
  });

  describe('searchProducts', () => {
    describe('basic functionality', () => {
      it('should return products with default pagination', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({}, em);

        expect(result).toHaveProperty('products');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('page');
        expect(result).toHaveProperty('totalPages');
        expect(result.page).toBe(1);
        expect(result.products.length).toBeLessThanOrEqual(20);
        expect(result.total).toBeGreaterThan(0);
        expect(result.totalPages).toBe(Math.ceil(result.total / 20));
      });

      it('should return all products when no filters applied', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({}, em);
        const totalProducts = await em.count(Product, {});

        expect(result.total).toBe(totalProducts);
      });

      it('should populate product category relationship', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ page: 1 }, em);

        expect(result.products).toHaveLength(20);
        expect(result.products[0].category).toBeDefined();
        expect(result.products[0].category.name).toBeDefined();
      });
    });

    describe('search filtering', () => {
      it('should filter products by name search', async () => {
        const em = orm.em.fork();
        const searchTerm = 'serum';
        const result = await searchProducts({ search: searchTerm }, em);

        expect(result.products.length).toBeGreaterThan(0);
        result.products.forEach((product) => {
          expect(
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.description?.toLowerCase().includes(searchTerm.toLowerCase())
          ).toBe(true);
        });
      });

      it('should filter products by description search', async () => {
        const em = orm.em.fork();
        const searchTerm = 'moisturizing';
        const result = await searchProducts({ search: searchTerm }, em);

        expect(result.products.length).toBeGreaterThan(0);
        result.products.forEach((product) => {
          expect(
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.description?.toLowerCase().includes(searchTerm.toLowerCase())
          ).toBe(true);
        });
      });

      it('should be case insensitive for search', async () => {
        const em = orm.em.fork();
        const lowerResult = await searchProducts({ search: 'cream' }, em);
        const upperResult = await searchProducts({ search: 'CREAM' }, em);
        const mixedResult = await searchProducts({ search: 'CrEaM' }, em);

        expect(lowerResult.total).toBe(upperResult.total);
        expect(lowerResult.total).toBe(mixedResult.total);
      });

      it('should return empty results for non-existent search term', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ search: 'zyxwvutsrq' }, em);

        expect(result.products).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(0);
      });
    });

    describe('category filtering', () => {
      it('should filter products by categoryId', async () => {
        const em = orm.em.fork();
        const targetCategory = categories[0];
        const result = await searchProducts({ categoryId: targetCategory.id }, em);

        expect(result.products.length).toBeGreaterThan(0);
        result.products.forEach((product) => {
          expect(product.category.id).toBe(targetCategory.id);
        });
      });

      it('should return products for each valid category', async () => {
        const em = orm.em.fork();

        for (const category of categories) {
          const result = await searchProducts({ categoryId: category.id }, em);
          expect(result.products.length).toBeGreaterThan(0);
          result.products.forEach((product) => {
            expect(product.category.id).toBe(category.id);
          });
        }
      });

      it('should return empty results for non-existent categoryId', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ categoryId: 99999 }, em);

        expect(result.products).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('price range filtering', () => {
      it('should filter products by minimum price', async () => {
        const em = orm.em.fork();
        const minPrice = 50;
        const result = await searchProducts({ minPrice }, em);

        expect(result.products.length).toBeGreaterThan(0);
        result.products.forEach((product) => {
          expect(product.price).toBeGreaterThanOrEqual(minPrice);
        });
      });

      it('should filter products by maximum price', async () => {
        const em = orm.em.fork();
        const maxPrice = 30;
        const result = await searchProducts({ maxPrice }, em);

        expect(result.products.length).toBeGreaterThan(0);
        result.products.forEach((product) => {
          expect(product.price).toBeLessThanOrEqual(maxPrice);
        });
      });

      it('should filter products by price range', async () => {
        const em = orm.em.fork();
        const minPrice = 20;
        const maxPrice = 40;
        const result = await searchProducts({ minPrice, maxPrice }, em);

        result.products.forEach((product) => {
          expect(product.price).toBeGreaterThanOrEqual(minPrice);
          expect(product.price).toBeLessThanOrEqual(maxPrice);
        });
      });

      it('should return empty results for impossible price range', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ minPrice: 1000, maxPrice: 2000 }, em);

        expect(result.products).toHaveLength(0);
        expect(result.total).toBe(0);
      });

      it('should handle edge case where minPrice equals maxPrice', async () => {
        const em = orm.em.fork();
        const price = 25.99;
        const result = await searchProducts({ minPrice: price, maxPrice: price }, em);

        result.products.forEach((product) => {
          expect(product.price).toBe(price);
        });
      });
    });

    describe('sorting', () => {
      it('should sort products by newest (default)', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ sortBy: 'newest' }, em);

        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
            result.products[i].createdAt.getTime()
          );
        }
      });

      it('should sort products by oldest', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ sortBy: 'oldest' }, em);

        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].createdAt.getTime()).toBeLessThanOrEqual(
            result.products[i].createdAt.getTime()
          );
        }
      });

      it('should sort products by price ascending', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ sortBy: 'price_asc' }, em);

        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].price).toBeLessThanOrEqual(result.products[i].price);
        }
      });

      it('should sort products by price descending', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ sortBy: 'price_desc' }, em);

        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].price).toBeGreaterThanOrEqual(result.products[i].price);
        }
      });

      it('should sort products by name', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ sortBy: 'name' }, em);

        for (let i = 1; i < result.products.length; i++) {
          expect(
            result.products[i - 1].name.localeCompare(result.products[i].name)
          ).toBeLessThanOrEqual(0);
        }
      });

      it('should default to newest when no sortBy specified', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({}, em);

        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
            result.products[i].createdAt.getTime()
          );
        }
      });
    });

    describe('pagination', () => {
      it('should handle custom page size', async () => {
        const em = orm.em.fork();
        const pageSize = 5;
        const result = await searchProducts({ pageSize }, em);

        expect(result.products.length).toBeLessThanOrEqual(pageSize);
      });

      it('should handle different pages', async () => {
        const em = orm.em.fork();
        const pageSize = 3;
        const page1 = await searchProducts({ page: 1, pageSize }, em);
        const page2 = await searchProducts({ page: 2, pageSize }, em);

        expect(page1.page).toBe(1);
        expect(page2.page).toBe(2);
        expect(page1.total).toBe(page2.total);

        const page1Ids = page1.products.map((p) => p.id);
        const page2Ids = page2.products.map((p) => p.id);
        const intersection = page1Ids.filter((id) => page2Ids.includes(id));
        expect(intersection).toHaveLength(0);
      });

      it('should calculate total pages correctly', async () => {
        const em = orm.em.fork();
        const pageSize = 7;
        const result = await searchProducts({ pageSize }, em);

        const expectedTotalPages = Math.ceil(result.total / pageSize);
        expect(result.totalPages).toBe(expectedTotalPages);
      });

      it('should handle page beyond available pages', async () => {
        const em = orm.em.fork();
        const result = await searchProducts({ page: 9999, pageSize: 10 }, em);

        expect(result.products).toHaveLength(0);
        expect(result.page).toBe(9999);
      });

      it('should use correct offset calculation', async () => {
        const em = orm.em.fork();
        const pageSize = 3;
        const allProducts = await searchProducts({ pageSize: 1000 }, em);
        const page3 = await searchProducts({ page: 3, pageSize }, em);

        const expectedProducts = allProducts.products.slice((3 - 1) * pageSize, 3 * pageSize);
        expect(page3.products.length).toBe(expectedProducts.length);
      });
    });

    describe('combined filters', () => {
      it('should combine search and category filters', async () => {
        const em = orm.em.fork();
        const targetCategory = categories.find((c) => c.name === 'skincare');
        const result = await searchProducts(
          {
            search: 'serum',
            categoryId: targetCategory?.id,
          },
          em
        );

        result.products.forEach((product) => {
          expect(product.category.id).toBe(targetCategory?.id);
          expect(
            product.name.toLowerCase().includes('serum') ||
              product.description?.toLowerCase().includes('serum')
          ).toBe(true);
        });
      });

      it('should combine search and price filters', async () => {
        const em = orm.em.fork();
        const result = await searchProducts(
          {
            search: 'cream',
            minPrice: 15,
            maxPrice: 35,
          },
          em
        );

        result.products.forEach((product) => {
          expect(product.price).toBeGreaterThanOrEqual(15);
          expect(product.price).toBeLessThanOrEqual(35);
          expect(
            product.name.toLowerCase().includes('cream') ||
              product.description?.toLowerCase().includes('cream')
          ).toBe(true);
        });
      });

      it('should combine category and price filters', async () => {
        const em = orm.em.fork();
        const targetCategory = categories[0];
        const result = await searchProducts(
          {
            categoryId: targetCategory.id,
            minPrice: 20,
            maxPrice: 50,
          },
          em
        );

        result.products.forEach((product) => {
          expect(product.category.id).toBe(targetCategory.id);
          expect(product.price).toBeGreaterThanOrEqual(20);
          expect(product.price).toBeLessThanOrEqual(50);
        });
      });

      it('should combine all filters with sorting and pagination', async () => {
        const em = orm.em.fork();
        const targetCategory = categories.find((c) => c.name === 'makeup');
        const result = await searchProducts(
          {
            search: 'lip',
            categoryId: targetCategory?.id,
            minPrice: 10,
            maxPrice: 30,
            sortBy: 'price_asc',
            page: 1,
            pageSize: 5,
          },
          em
        );

        expect(result.products.length).toBeLessThanOrEqual(5);
        expect(result.page).toBe(1);

        result.products.forEach((product) => {
          expect(product.category.id).toBe(targetCategory?.id);
          expect(product.price).toBeGreaterThanOrEqual(10);
          expect(product.price).toBeLessThanOrEqual(30);
          expect(
            product.name.toLowerCase().includes('lip') ||
              product.description?.toLowerCase().includes('lip')
          ).toBe(true);
        });

        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].price).toBeLessThanOrEqual(result.products[i].price);
        }
      });

      it('should return empty results when combined filters are too restrictive', async () => {
        const em = orm.em.fork();
        const result = await searchProducts(
          {
            search: 'nonexistent',
            categoryId: categories[0].id,
            minPrice: 200,
            maxPrice: 300,
          },
          em
        );

        expect(result.products).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(0);
      });
    });
  });
});
