import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { config } from '../config.js';
import { validateSession, verifySessionToken } from './session.service.js';
import { db } from '../database.js';
import { InvalidSessionError } from '../error.js';

export async function authMiddleware(c: Context, next: () => Promise<void>) {
  const sessionToken = getCookie(c, config.sessionCookieName);

  if (!sessionToken) {
    throw new InvalidSessionError();
  }

  const sessionId = await verifySessionToken(sessionToken);

  const user = await validateSession(sessionId, db.em);

  c.set('user', user);

  await next();
}
