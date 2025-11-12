import { Hono } from 'hono';
import { z } from 'zod';
import { login, register } from './auth.service.js';
import { deleteCookie, setCookie } from 'hono/cookie';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { db } from '../database.js';
import { config } from '../config.js';
import { authMiddleware } from './auth.middleware.js';
import type { Variables } from './variable.js';
import { deleteSessionsByUser } from './session.service.js';
import { badRequestResponseSchema, appErrorResponseSchema } from '../api-schema.js';

export const auth = new Hono<{ Variables: Variables }>().basePath('');

auth.post(
  '/users',
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
                  user: z.object({
                    id: z.number(),
                    email: z.string(),
                    createdAt: z.string(),
                  }),
                }),
              })
            ),
          },
        },
      },
      400: {
        description: 'bad request response',
        content: {
          'application/json': {
            schema: resolver(badRequestResponseSchema),
          },
        },
      },
      409: {
        description: 'email conflict response',
        content: {
          'application/json': {
            schema: resolver(badRequestResponseSchema),
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
      email: z.email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');

    const { user, sessionId } = await register(body, db.em);

    setCookie(c, config.sessionCookieName, sessionId, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'Strict',
      maxAge: 86400,
      path: '/',
    });

    return c.success({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  }
);

auth.post(
  'auth/users/session',
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
                  user: z.object({
                    id: z.number(),
                    email: z.string(),
                    createdAt: z.string(),
                  }),
                }),
              })
            ),
          },
        },
      },
      400: {
        description: 'bad request response',
        content: {
          'application/json': {
            schema: resolver(badRequestResponseSchema),
          },
        },
      },
      401: {
        description: 'invalid credential response',
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
      email: z.email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');

    const { user, sessionId } = await login(body, db.em);

    setCookie(c, config.sessionCookieName, sessionId, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'Strict',
      maxAge: 86400,
      path: '/',
    });

    return c.success({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  }
);

auth.delete(
  'auth/users/session',
  describeRoute({
    responses: {
      200: {
        description: 'successful response',
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                message: z.string(),
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
    const user = c.get('user');
    await deleteSessionsByUser(user, db.em);
    deleteCookie(c, config.sessionCookieName);

    return c.success({
      message: 'Logged out successfully',
    });
  }
);
