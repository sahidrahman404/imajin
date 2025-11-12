import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { User } from './user.entity.js';
import { Session } from './session.entity.js';
import { EntityManager } from '@mikro-orm/core';
import { ExpiredSessionError, InvalidSessionError } from '../error.js';

export async function createSession(user: User, em: EntityManager) {
  const session = new Session();
  session.user = user;
  session.sessionId = randomBytes(32).toString('hex');
  session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await em.persist(session).flush();

  return signSession(session.sessionId);
}

export async function validateSession(sessionId: string, em: EntityManager): Promise<User> {
  const session = await em.findOne(Session, { sessionId: sessionId }, { populate: ['user'] });

  if (!session) {
    throw new InvalidSessionError();
  }

  if (session.expiresAt < new Date()) {
    await deleteBySessionId(sessionId, em);
    throw new ExpiredSessionError();
  }

  return session.user;
}

async function deleteBySessionId(sessionId: string, em: EntityManager): Promise<boolean> {
  const session = await em.findOne(Session, { sessionId: sessionId });
  if (!session) return false;

  await em.removeAndFlush(session);
  return true;
}

export async function deleteSessionsByUser(user: User, em: EntityManager): Promise<boolean> {
  const sessions = await em.find(Session, { user: user });
  await em.removeAndFlush(sessions);
  return true;
}

export async function deleteExpiredSessions(em: EntityManager): Promise<number> {
  const expiredSessions = await em.find(Session, { expiresAt: { $lt: new Date() } });
  await em.removeAndFlush(expiredSessions);
  return expiredSessions.length;
}

export function signSession(sessionId: string) {
  const hmac = createHmac('sha256', config.sessionSecret).update(sessionId).digest('hex');
  return `${sessionId}.${hmac}`;
}

export function verifySessionToken(sessionToken: string) {
  const [id, hmac] = sessionToken.split('.');
  if (!id || !hmac) {
    throw new InvalidSessionError();
  }

  const expected = createHmac('sha256', config.sessionSecret).update(id).digest('hex');

  try {
    if (timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
      return id;
    }
  } catch {
    throw new InvalidSessionError();
  }

  throw new InvalidSessionError();
}
