import { Hono } from 'hono';
import { z } from 'zod';
import { describeRoute, resolver, validator } from 'hono-openapi';
import type { Variables } from '../auth/variable.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { db } from '../database.js';
import {
  getCartWithItems,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from './cart.service.js';
import { appErrorResponseSchema } from '../api-schema.js';
import { successCartResponseSchema } from './cart.schema.js';

export const cart = new Hono<{ Variables: Variables }>().basePath('/carts');

cart.get(
  '/',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successCartResponseSchema),
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
    const cart = await getCartWithItems(user, db.em);
    return c.success({ cart: cart });
  }
);

cart.post(
  '/items',
  authMiddleware,
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successCartResponseSchema),
          },
        },
      },
      400: {
        description: 'product not found error response',
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
  validator(
    'json',
    z.object({
      productId: z.number().positive('Product ID must be a positive number'),
      quantity: z.number().positive('Quantity must be a positive number').default(1),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { productId, quantity } = c.req.valid('json');

    await addToCart(user, productId, quantity, db.em);

    const cart = await getCartWithItems(user, db.em);
    return c.success({ cart: cart });
  }
);

cart.put(
  '/items/:productId',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successCartResponseSchema),
          },
        },
      },
      400: {
        description: 'item or cart not found error response',
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
    'param',
    z.object({
      productId: z.coerce.number(),
    })
  ),
  validator(
    'json',
    z.object({
      quantity: z.number().positive('Quantity must be a positive number'),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { productId } = c.req.valid('param');
    const { quantity } = c.req.valid('json');

    await updateCartItem(user, productId, quantity, db.em);

    const cart = await getCartWithItems(user, db.em);
    return c.success({ cart: cart });
  }
);

cart.delete(
  '/',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(z.object({ message: z.string() })),
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
    await clearCart(user, db.em);

    return c.success({ message: 'Cart cleared successfully' });
  }
);

cart.delete(
  '/items/:productId',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(successCartResponseSchema),
          },
        },
      },
      400: {
        description: 'item or cart not found error response',
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
    'param',
    z.object({
      productId: z.coerce.number(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { productId } = c.req.valid('param');

    await removeFromCart(user, productId, db.em);

    const cart = await getCartWithItems(user, db.em);
    return c.success({ cart: cart });
  }
);
