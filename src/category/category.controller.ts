import { Hono } from 'hono';
import type { Variables } from '@/src/auth/variable.js';
import { authMiddleware } from '@/src/auth/auth.middleware.js';
import { db } from '@/src/database.js';
import { getAllCategories } from '@/src/category/category.service.js';

export const category = new Hono<{ Variables: Variables }>().basePath('/categories');

category.get('/', authMiddleware, async (c) => {
  const categories = await getAllCategories(db.em);
  return c.json({ categories });
});
