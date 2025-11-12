import type { EntityManager } from '@mikro-orm/core';
import { Category } from '@/src/category/category.entity.js';

export async function getAllCategories(em: EntityManager): Promise<Category[]> {
  return await em.findAll(Category);
}
