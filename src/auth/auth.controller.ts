import { Hono } from 'hono';
import { z } from 'zod';
import { login, register } from '@/src/auth/auth.service.js';
import { deleteCookie, setCookie } from 'hono/cookie';
import { validator } from 'hono-openapi';
import { db } from '@/src/database.js';
import { config } from '@/src/config.js';
import { authMiddleware } from '@/src/auth/auth.middleware.js';
import type { Variables } from '@/src/auth/variable.js';
import { deleteSessionsByUser } from '@/src/auth/session.service.js';

export const auth = new Hono<{ Variables: Variables }>().basePath('');

auth.post(
  '/users',
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
      secure: process.env.NODE_ENV === 'production',
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
      secure: process.env.NODE_ENV === 'production',
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

auth.delete('auth/users/session', authMiddleware, async (c) => {
  const user = c.get('user');
  await deleteSessionsByUser(user, db.em);
  deleteCookie(c, config.sessionCookieName);

  return c.success({
    message: 'Logged out successfully',
  });
});

auth.get('auth/users', authMiddleware, async (c) => {
  const user = c.get('user');

  return c.success({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});
