import { Hono } from 'hono';
import { z } from 'zod';
import { validator } from 'hono-openapi';
import type { Variables } from '../auth/variable.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { db } from '../database.js';
import { createOrder, getOrderHistory, getOrderById } from './order.service.js';

export const order = new Hono<{ Variables: Variables }>().basePath('/orders');

order.post('/', authMiddleware, async (c) => {
  const user = c.get('user');

  const orderData = await createOrder(user, db.em);

  return c.success(orderData);
});

order.post(
  '/partial',
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

    return c.success(orderData);
  }
);

order.get(
  '/',
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

    return c.success(orderData);
  }
);
