import { Hono } from 'hono';
import { z } from 'zod';
import { describeRoute, resolver, validator } from 'hono-openapi';
import type { Variables } from '../auth/variable.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { db } from '../database.js';
import { createOrder, getOrderHistory, getOrderById } from './order.service.js';
import { appErrorResponseSchema } from '@/src/api-schema.js';
import { orderStatusSchema, successOrderSchema } from '@/src/order/order.schema.js';

export const order = new Hono<{ Variables: Variables }>().basePath('/orders');

order.post(
  '/',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successOrderSchema),
          },
        },
      },
      400: {
        description: 'cart empty error response',
        content: {
          'application/json': {
            schema: resolver(appErrorResponseSchema),
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
    const user = c.get('user');

    const orderData = await createOrder(user, db.em);

    return c.success({ order: orderData });
  }
);

order.post(
  '/partial',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successOrderSchema),
          },
        },
      },
      400: {
        description: 'cart empty error response',
        content: {
          'application/json': {
            schema: resolver(appErrorResponseSchema),
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
  validator(
    'json',
    z.object({
      selectedItemIds: z
        .array(z.number().positive('Item ID must be a positive number'))
        .min(1, 'At least one item must be selected'),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { selectedItemIds } = c.req.valid('json');

    const orderData = await createOrder(user, db.em, { selectedItemIds });

    return c.success({ order: orderData });
  }
);

order.get(
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
                  orders: z.array(
                    z.object({
                      id: z.number(),
                      total: z.number(),
                      status: orderStatusSchema,
                      createdAt: z.string(),
                      updatedAt: z.string(),
                      items: z.array(
                        z.object({
                          id: z.number(),
                          quantity: z.number(),
                          price: z.number(),
                          product: z.object({
                            id: z.number(),
                            name: z.string(),
                            description: z.string(),
                          }),
                          subtotal: z.number(),
                        })
                      ),
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
  authMiddleware,
  validator(
    'query',
    z.object({
      page: z
        .string()
        .transform((val) => (val ? Math.max(parseInt(val, 10), 1) : 1))
        .optional(),
      pageSize: z
        .string()
        .transform((val) => (val ? Math.min(Math.max(parseInt(val, 10), 1), 50) : 10))
        .optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { page = 1, pageSize = 10 } = c.req.valid('query');

    const orderHistory = await getOrderHistory(user, db.em, page, pageSize);

    return c.success(orderHistory);
  }
);

order.get(
  '/:id',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successOrderSchema),
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
  validator(
    'param',
    z.object({
      id: z.coerce.number(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { id } = c.req.valid('param');

    const orderData = await getOrderById(id, user, db.em);

    return c.success({ order: orderData });
  }
);
