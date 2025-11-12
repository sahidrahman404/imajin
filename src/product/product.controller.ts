import { Hono } from 'hono';
import type { Variables } from '@/src/auth/variable.js';
import { validator } from 'hono-openapi';
import { z } from 'zod';
import { authMiddleware } from '@/src/auth/auth.middleware.js';
import { searchProducts } from '@/src/product/product.service.js';
import { db } from '@/src/database.js';

export const product = new Hono<{ Variables: Variables }>().basePath('/products');

product.get(
  '/',
  authMiddleware,
  validator(
    'query',
    z.object({
      search: z.coerce.string().optional(),
      categoryId: z.coerce.number().optional(),
      minPrice: z
        .string()
        .transform((val) => (val ? parseFloat(val) : undefined))
        .optional(),
      maxPrice: z
        .string()
        .transform((val) => (val ? parseFloat(val) : undefined))
        .optional(),
      sortBy: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'name']).optional(),
      page: z
        .string()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .optional(),
      pageSize: z
        .string()
        .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20))
        .optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid('query');
    const products = await searchProducts(body, db.em);
    return c.json({ products });
  }
);
