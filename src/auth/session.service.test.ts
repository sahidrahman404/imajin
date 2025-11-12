import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  signSession,
  verifySessionToken,
  createSession,
  validateSession,
  deleteSessionsByUser,
  deleteExpiredSessions,
} from '@/src/auth/session.service.js';
import { User } from '@/src/auth/user.entity.js';
import { Session } from '@/src/auth/session.entity.js';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import type { ORM } from '@/src/database.js';
import { InvalidSessionError, ExpiredSessionError } from '@/src/error.js';
import { hash } from '@node-rs/argon2';
import config from '@/src/mikro-orm.config.js';

vi.mock('@/src/config.js', () => ({
  config: {
    sessionSecret: 'test-secret-key-for-testing',
  },
}));

describe('session cryptography', () => {
  describe('signSession', () => {
    const testSessionId = randomBytes(32).toString('hex');
    it('should return a signed session string with sessionId and HMAC', () => {
      const signed = signSession(testSessionId);

      expect(signed).toContain('.');
      const [id, hmac] = signed.split('.');
      expect(id).toBe(testSessionId);
      expect(hmac).toHaveLength(64);
    });

    it('should produce consistent signatures for the same sessionId', () => {
      const signed1 = signSession(testSessionId);
      const signed2 = signSession(testSessionId);

      expect(signed1).toBe(signed2);
    });

    it('should produce different signatures for different sessionIds', () => {
      const signed1 = signSession(randomBytes(32).toString('hex'));
      const signed2 = signSession(randomBytes(32).toString('hex'));

      expect(signed1).not.toBe(signed2);
    });

    it('should handle empty string sessionId', () => {
      const signed = signSession('');

      expect(signed).toContain('.');
      const [id, hmac] = signed.split('.');
      expect(id).toBe('');
      expect(hmac).toHaveLength(64);
    });
  });

  describe('verifySessionToken', () => {
    const testSessionId = randomBytes(32).toString('hex');
    it('should successfully verify a valid signed session', () => {
      const signed = signSession(testSessionId);
      const verified = verifySessionToken(signed);

      expect(verified).toBe(testSessionId);
    });

    it('should throw InvalidSessionError for tampered sessionId', () => {
      const signed = signSession(testSessionId);
      const [id, hmac] = signed.split('.');
      const tamperedSigned = `${id}modified.${hmac}`;

      expect(() => verifySessionToken(tamperedSigned)).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for tampered HMAC', () => {
      const signed = signSession(testSessionId);
      const [id, hmac] = signed.split('.');
      const tamperedHmac = hmac.slice(0, -1) + 'a';
      const tamperedSigned = `${id}.${tamperedHmac}`;

      expect(() => verifySessionToken(tamperedSigned)).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for missing HMAC', () => {
      expect(() => verifySessionToken(testSessionId)).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for missing sessionId', () => {
      expect(() => verifySessionToken('.somehash')).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for malformed signed string (no dot)', () => {
      expect(() => verifySessionToken('noseparatorhere')).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for empty string', () => {
      expect(() => verifySessionToken('')).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for invalid hex in HMAC', () => {
      const signed = `${testSessionId}.notvalidhex`;

      expect(() => verifySessionToken(signed)).toThrow(InvalidSessionError);
    });

    it('should throw InvalidSessionError for HMAC with wrong length', () => {
      const signed = `${testSessionId}.abc123`;

      expect(() => verifySessionToken(signed)).toThrow(InvalidSessionError);
    });
  });
});

describe('session service integration tests', () => {
  let orm: ORM;

  beforeEach(async () => {
    orm = await MikroORM.init({
      ...config,
      dbName: ':memory:',
      debug: false,
    });

    await orm.schema.createSchema();
  });

  afterEach(async () => {
    await orm.close();
  });

  describe('createSession', () => {
    it('should create a new session for a user', async () => {
      const em = orm.em.fork();

      const user = new User();
      user.email = 'test@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      const signedSessionId = await createSession(user, em);

      expect(signedSessionId).toBeDefined();
      expect(typeof signedSessionId).toBe('string');
      expect(signedSessionId).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);

      const sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].user.id).toBe(user.id);
      expect(sessions[0].expiresAt).toBeInstanceOf(Date);
      expect(sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create session with proper expiration time (7 days)', async () => {
      const em = orm.em.fork();

      const user = new User();
      user.email = 'test@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      const beforeCreation = Date.now();
      await createSession(user, em);
      const afterCreation = Date.now();

      const session = await em.findOne(Session, { user });
      expect(session).toBeDefined();

      const expectedMinExpiry = beforeCreation + 7 * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = afterCreation + 7 * 24 * 60 * 60 * 1000;

      expect(session!.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(session!.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should generate unique session IDs for multiple sessions', async () => {
      const em = orm.em.fork();

      const user = new User();
      user.email = 'test@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      const sessionId1 = await createSession(user, em);
      const sessionId2 = await createSession(user, em);

      expect(sessionId1).not.toBe(sessionId2);

      const sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).not.toBe(sessions[1].sessionId);
    });

    it('should persist session to database correctly', async () => {
      const em = orm.em.fork();

      const user = new User();
      user.email = 'test@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      await createSession(user, em);

      const sessionFromDb = await em.findOne(Session, { user }, { populate: ['user'] });
      expect(sessionFromDb).toBeDefined();
      expect(sessionFromDb!.user.id).toBe(user.id);
      expect(sessionFromDb!.sessionId).toBeDefined();
      expect(sessionFromDb!.sessionId.length).toBe(64);
      expect(sessionFromDb!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('validateSession', () => {
    let user: User;
    let validSessionId: string;
    let em: any;

    beforeEach(async () => {
      em = orm.em.fork();

      user = new User();
      user.email = 'test@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      const signedSession = await createSession(user, em);
      validSessionId = verifySessionToken(signedSession);
    });

    it('should return user for valid session', async () => {
      const returnedUser = await validateSession(validSessionId, em);

      expect(returnedUser).toBeDefined();
      expect(returnedUser.id).toBe(user.id);
      expect(returnedUser.email).toBe(user.email);
    });

    it('should throw InvalidSessionError for non-existent session', async () => {
      const fakeSessionId = 'nonexistent123';

      await expect(validateSession(fakeSessionId, em)).rejects.toThrow(InvalidSessionError);
    });

    it('should throw ExpiredSessionError and delete expired session', async () => {
      const expiredSession = new Session();
      expiredSession.user = user;
      expiredSession.sessionId = 'expired123';
      expiredSession.expiresAt = new Date(Date.now() - 1000);
      await em.persist(expiredSession).flush();

      await expect(validateSession('expired123', em)).rejects.toThrow(ExpiredSessionError);

      const deletedSession = await em.findOne(Session, { sessionId: 'expired123' });
      expect(deletedSession).toBeNull();
    });

    it('should populate user entity correctly', async () => {
      const returnedUser = await validateSession(validSessionId, em);

      expect(returnedUser).toBeInstanceOf(User);
      expect(returnedUser.email).toBe('test@example.com');
      expect(returnedUser.createdAt).toBeInstanceOf(Date);
      expect(returnedUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should work with sessions created at different times', async () => {
      const session1Id = verifySessionToken(await createSession(user, em));

      await new Promise((resolve) => setTimeout(resolve, 10));

      const session2Id = verifySessionToken(await createSession(user, em));

      const user1 = await validateSession(session1Id, em);
      const user2 = await validateSession(session2Id, em);

      expect(user1.id).toBe(user.id);
      expect(user2.id).toBe(user.id);
    });
  });

  describe('deleteSessionsByUser', () => {
    let user: User;
    let em: any;

    beforeEach(async () => {
      em = orm.em.fork();

      user = new User();
      user.email = 'test@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();
    });

    it('should delete all sessions for a user', async () => {
      await createSession(user, em);
      await createSession(user, em);
      await createSession(user, em);

      let sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(3);

      const result = await deleteSessionsByUser(user, em);

      expect(result).toBe(true);

      sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(0);
    });

    it('should not affect sessions of other users', async () => {
      const otherUser = new User();
      otherUser.email = 'other@example.com';
      otherUser.password = await hash('password456');
      await em.persist(otherUser).flush();

      await createSession(user, em);
      await createSession(user, em);
      await createSession(otherUser, em);

      const result = await deleteSessionsByUser(user, em);

      expect(result).toBe(true);

      const userSessions = await em.find(Session, { user });
      const otherUserSessions = await em.find(Session, { user: otherUser });

      expect(userSessions).toHaveLength(0);
      expect(otherUserSessions).toHaveLength(1);
    });

    it('should return true even when user has no sessions', async () => {
      const sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(0);

      const result = await deleteSessionsByUser(user, em);

      expect(result).toBe(true);
    });

    it('should handle user with many sessions efficiently', async () => {
      for (let i = 0; i < 10; i++) {
        await createSession(user, em);
      }

      let sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(10);

      const result = await deleteSessionsByUser(user, em);

      expect(result).toBe(true);

      sessions = await em.find(Session, { user });
      expect(sessions).toHaveLength(0);
    });
  });

  describe('deleteExpiredSessions', () => {
    let em: any;

    beforeEach(async () => {
      em = orm.em.fork();
    });

    it('should delete expired sessions and return count', async () => {
      const user1 = new User();
      user1.email = 'user1@example.com';
      user1.password = await hash('password123');
      await em.persist(user1).flush();

      const user2 = new User();
      user2.email = 'user2@example.com';
      user2.password = await hash('password456');
      await em.persist(user2).flush();

      const expiredSession1 = new Session();
      expiredSession1.user = user1;
      expiredSession1.sessionId = 'expired1';
      expiredSession1.expiresAt = new Date(Date.now() - 1000);

      const expiredSession2 = new Session();
      expiredSession2.user = user2;
      expiredSession2.sessionId = 'expired2';
      expiredSession2.expiresAt = new Date(Date.now() - 2000);

      const validSession = new Session();
      validSession.user = user1;
      validSession.sessionId = 'valid1';
      validSession.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await em.persist([expiredSession1, expiredSession2, validSession]).flush();

      const deletedCount = await deleteExpiredSessions(em);

      expect(deletedCount).toBe(2);

      const remainingSessions = await em.find(Session, {});
      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0].sessionId).toBe('valid1');
    });

    it('should return 0 when no sessions are expired', async () => {
      const user = new User();
      user.email = 'user@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      await createSession(user, em);
      await createSession(user, em);

      const deletedCount = await deleteExpiredSessions(em);

      expect(deletedCount).toBe(0);

      const sessions = await em.find(Session, {});
      expect(sessions).toHaveLength(2);
    });

    it('should handle empty session table', async () => {
      const deletedCount = await deleteExpiredSessions(em);

      expect(deletedCount).toBe(0);
    });

    it('should delete sessions that expired exactly at current time', async () => {
      const user = new User();
      user.email = 'user@example.com';
      user.password = await hash('password123');
      await em.persist(user).flush();

      const exactlyExpiredSession = new Session();
      exactlyExpiredSession.user = user;
      exactlyExpiredSession.sessionId = 'exactly_expired';
      exactlyExpiredSession.expiresAt = new Date(Date.now());
      await em.persist(exactlyExpiredSession).flush();

      await new Promise((resolve) => setTimeout(resolve, 1));

      const deletedCount = await deleteExpiredSessions(em);

      expect(deletedCount).toBe(1);
    });
  });
});
