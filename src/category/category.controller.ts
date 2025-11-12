import { Hono } from 'hono';
import type { Variables } from '@/src/auth/variable.js';
import { authMiddleware } from '@/src/auth/auth.middleware.js';
import { db } from '@/src/database.js';
import { getAllCategories } from '@/src/category/category.service.js';
import { describeRoute, resolver } from 'hono-openapi';
import { successOrderSchema } from '@/src/order/order.schema.js';
import { appErrorResponseSchema } from '@/src/api-schema.js';
import { z } from 'zod';

export const category = new Hono<{ Variables: Variables }>().basePath('/categories');

category.get(
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
                  categories: z.array(
                    z.object({
                      id: z.number(),
                      name: z.string(),
                      description: z.string(),
                      createdAt: z.string(),
                    })
                  ),
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
  authMiddleware,
  async (c) => {
    const categories = await getAllCategories(db.em);
    return c.success({ categories });
  }
);
