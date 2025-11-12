import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { auth } from '@/src/auth/auth.controller.js';
import { AppError, EmailConflictError } from '@/src/error.js';
import { RequestContext } from '@mikro-orm/core';
import { db } from '@/src/database.js';
import { product } from '@/src/product/product.controller.js';
import { category } from '@/src/category/category.controller.js';
import { cart } from '@/src/cart/cart.controller.js';
import { order } from '@/src/order/order.controller.js';

const app = new Hono().basePath('/api/v1');

declare module 'hono' {
  interface Context {
    success: (data: any) => Response;
  }
}

app.use(async (_, next) => {
  await RequestContext.create(db.em, async () => {
    await next();
  });
});

app.onError((err, c) => {
  if (err instanceof HTTPException || err instanceof AppError) {
    return c.json(
      {
        success: false,
        message: err.message,
      },
      err.status
    );
  }

  if (err instanceof EmailConflictError) {
    return c.json(
      {
        success: false,
        error: [
          {
            path: ['email'],
            message: 'A user with this email address already exists. Please use a different email.',
          },
        ],
      },
      409
    );
  }

  console.error('Unhandled error:', err);

  return c.json(
    {
      success: false,
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

app.use('*', async (c, next) => {
  c.success = (data: any) => {
    return c.json({ success: true, data }, 200);
  };
  await next();
});

app.route('/', auth);
app.route('/', product);
app.route('/', category);
app.route('/', cart);
app.route('/', order);

app.get('/health-check', (c) => {
  return c.success({ greeting: 'Healthy' });
});

const server = serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

process.on('SIGINT', () => {
  server.close(async () => {
    await db.orm.close();
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close(async (err) => {
    await db.orm.close();
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
