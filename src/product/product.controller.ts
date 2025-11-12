import { Hono } from 'hono';
import type { Variables } from '../auth/variable.js';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { searchProducts } from './product.service.js';
import { db } from '../database.js';
import { appErrorResponseSchema } from '../api-schema.js';

export const product = new Hono<{ Variables: Variables }>().basePath('/products');

product.get(
  '/',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                success: z.boolean(),
                data: z.object({
                  products: z.array(
                    z.object({
                      id: z.number(),
                      name: z.string(),
                      description: z.string(),
                      price: z.number(),
                      category: z.object({
                        id: z.number(),
                        name: z.string(),
                        description: z.string(),
                        createdAt: z.string(),
                      }),
                      createdAt: z.string(),
                      updatedAt: z.string(),
                    })
                  ),
                  total: z.number(),
                  page: z.number(),
                  totalPages: z.number(),
                }),
              })
            ),
          },
        },
      },
      500: {
        description: 'internal server error response',
        content: {
          'application/json': {
            schema: resolver(appErrorResponseSchema),
          },
        },
      },
    },
  }),
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
    return c.success(products);
  }
);
