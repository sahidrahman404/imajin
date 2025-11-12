import { Product } from './product.entity.js';
import type { EntityManager } from '@mikro-orm/core';

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name';
  limit?: number;
  offset?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export async function searchProducts(
  filters: ProductFilters & { page?: number; pageSize?: number },
  em: EntityManager
): Promise<ProductSearchResult> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const productFilters: ProductFilters = {
    ...filters,
    limit: pageSize,
    offset,
  };

  const [products, total] = await Promise.all([
    findWithFilters(productFilters, em),
    em.count(Product, filterProducts(productFilters)),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    products,
    total,
    page,
    totalPages,
  };
}

async function findWithFilters(
  filters: ProductFilters = {},
  em: EntityManager
): Promise<Product[]> {
  const where: any = filterProducts(filters);

  let orderBy: any;
  switch (filters.sortBy) {
    case 'newest':
      orderBy = { createdAt: 'DESC' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'ASC' };
      break;
    case 'price_asc':
      orderBy = { price: 'ASC' };
      break;
    case 'price_desc':
      orderBy = { price: 'DESC' };
      break;
    case 'name':
      orderBy = { name: 'ASC' };
      break;
    default:
      orderBy = { createdAt: 'DESC' };
  }

  return em.find(Product, where, {
    populate: ['category'],
    orderBy,
    limit: filters.limit,
    offset: filters.offset,
  });
}

function filterProducts(filters: ProductFilters = {}) {
  const where: any = {};

  if (filters.search) {
    where.$or = [
      { name: { $like: `%${filters.search}%` } },
      { description: { $like: `%${filters.search}%` } },
    ];
  }

  if (filters.categoryId) {
    where.category = filters.categoryId;
  }

  if (filters.minPrice !== undefined) {
    where.price = { ...where.price, $gte: filters.minPrice };
  }
  if (filters.maxPrice !== undefined) {
    where.price = { ...where.price, $lte: filters.maxPrice };
  }

  return where;
}
