import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verify } from '@node-rs/argon2';
import { register, login } from '@/src/auth/auth.service.js';
import { User } from '@/src/auth/user.entity.js';
import { Session } from '@/src/auth/session.entity.js';
import { MikroORM } from '@mikro-orm/core';
import type { ORM } from '@/src/database.js';
import { EmailConflictError, InvalidCredentialError } from '@/src/error.js';
import config from '@/src/mikro-orm.config.js';

vi.mock('@/src/config.js', () => ({
  config: {
    sessionSecret: 'test-secret-key-for-testing',
  },
}));

describe('register', () => {
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

  describe('successful registration', () => {
    it('should register a new user with valid data', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const result = await register(registerData, em);

      expect(result).toBeDefined();
      expect(result.user).toBeInstanceOf(User);
      expect(result.user.email).toBe(registerData.email);
      expect(result.user.id).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('should hash the password correctly using Argon2', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const result = await register(registerData, em);

      expect(result.user.password).not.toBe(registerData.password);
      expect(result.user.password.length).toBeGreaterThan(0);

      const isValidPassword = await verify(result.user.password, registerData.password);
      expect(isValidPassword).toBe(true);

      const isInvalidPassword = await verify(result.user.password, 'wrongpassword');
      expect(isInvalidPassword).toBe(false);
    });

    it('should create and sign a session', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const result = await register(registerData, em);

      expect(result.sessionId).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);

      const sessions = await em.find(Session, {});
      expect(sessions).toHaveLength(1);
      expect(sessions[0].user.id).toBe(result.user.id);
      expect(sessions[0].expiresAt).toBeInstanceOf(Date);
      expect(sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should persist user to database', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const result = await register(registerData, em);

      const userFromDb = await em.findOne(User, { id: result.user.id });
      expect(userFromDb).toBeDefined();
      expect(userFromDb!.email).toBe(registerData.email);
      expect(userFromDb!.createdAt).toBeInstanceOf(Date);
      expect(userFromDb!.updatedAt).toBeInstanceOf(Date);
    });

    it('should set proper timestamps', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const beforeRegistration = new Date();

      const em = orm.em.fork();
      const result = await register(registerData, em);
      const afterRegistration = new Date();

      expect(result.user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime());
      expect(result.user.createdAt.getTime()).toBeLessThanOrEqual(afterRegistration.getTime());
      expect(result.user.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime());
      expect(result.user.updatedAt.getTime()).toBeLessThanOrEqual(afterRegistration.getTime());
    });
  });

  describe('error handling', () => {
    it('should handle duplicate email addresses', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(registerData, em);
      await expect(register(registerData, em)).rejects.toThrow(EmailConflictError);
    });

    it('should rollback transaction on error', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(registerData, em);

      const initialUserCount = await em.count(User);
      const initialSessionCount = await em.count(Session);

      try {
        await register(registerData, em);
      } catch (error) {}

      const finalUserCount = await em.count(User);
      const finalSessionCount = await em.count(Session);

      expect(finalUserCount).toBe(initialUserCount);
      expect(finalSessionCount).toBe(initialSessionCount);
    });
  });

  describe('session expiration', () => {
    it('should set session expiration to 7 days from now', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const beforeRegistration = Date.now();
      const em = orm.em.fork();
      await register(registerData, em);
      const afterRegistration = Date.now();

      const sessions = await em.find(Session, {});
      expect(sessions).toHaveLength(1);

      const session = sessions[0];
      const expectedMinExpiry = beforeRegistration + 7 * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = afterRegistration + 7 * 24 * 60 * 60 * 1000;

      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });
  });
});

describe('login', () => {
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

  describe('successful login', () => {
    it('should login with valid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const loginData = {
        email: userData.email,
        password: userData.password,
      };

      const result = await login(loginData, em);

      expect(result).toBeDefined();
      expect(result.user).toBeInstanceOf(User);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.id).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('should create and sign a new session on login', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const loginData = {
        email: userData.email,
        password: userData.password,
      };

      const result = await login(loginData, em);

      expect(result.sessionId).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);

      const sessions = await em.find(Session, { user: { email: userData.email } });
      expect(sessions).toHaveLength(2);

      const loginSession = sessions.find(
        (s) => s.user.email === userData.email && s.sessionId !== sessions[0].sessionId
      );
      expect(loginSession).toBeDefined();
      expect(loginSession!.expiresAt).toBeInstanceOf(Date);
      expect(loginSession!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should verify password using Argon2', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const registerResult = await register(userData, em);

      const loginData = {
        email: userData.email,
        password: userData.password,
      };

      const result = await login(loginData, em);

      expect(result.user.id).toBe(registerResult.user.id);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.password).toBe(registerResult.user.password);
    });

    it('should set session expiration to 7 days from login', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const beforeLogin = Date.now();
      await login(userData, em);
      const afterLogin = Date.now();

      const sessions = await em.find(Session, { user: { email: userData.email } });
      const loginSession = sessions.find((s) => s.sessionId !== sessions[0].sessionId);

      expect(loginSession).toBeDefined();

      const expectedMinExpiry = beforeLogin + 7 * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = afterLogin + 7 * 24 * 60 * 60 * 1000;

      expect(loginSession!.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(loginSession!.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should return the correct user from database', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const registerResult = await register(userData, em);

      const result = await login(userData, em);

      expect(result.user.id).toBe(registerResult.user.id);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.createdAt).toBeInstanceOf(Date);
      expect(result.user.updatedAt).toBeInstanceOf(Date);
      expect(result.user.createdAt).toEqual(registerResult.user.createdAt);
    });
  });

  describe('authentication failures', () => {
    it('should throw InvalidCredentialError for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      };

      const em = orm.em.fork();
      await expect(login(loginData, em)).rejects.toThrow(InvalidCredentialError);
    });

    it('should throw InvalidCredentialError for wrong password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'correctpassword',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const loginData = {
        email: userData.email,
        password: 'wrongpassword',
      };

      await expect(login(loginData, em)).rejects.toThrow(InvalidCredentialError);
    });

    it('should not create session when authentication fails', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'correctpassword',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const initialSessionCount = await em.count(Session);

      const loginData = {
        email: userData.email,
        password: 'wrongpassword',
      };

      try {
        await login(loginData, em);
      } catch (error) {}

      const finalSessionCount = await em.count(Session);
      expect(finalSessionCount).toBe(initialSessionCount);
    });

    it('should handle empty email gracefully', async () => {
      const loginData = {
        email: '',
        password: 'anypassword',
      };

      const em = orm.em.fork();
      await expect(login(loginData, em)).rejects.toThrow(InvalidCredentialError);
    });

    it('should handle email case sensitivity correctly', async () => {
      const userData = {
        email: 'Test@Example.Com',
        password: 'correctpassword',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const loginData = {
        email: 'test@example.com',
        password: userData.password,
      };

      await expect(login(loginData, em)).rejects.toThrow(InvalidCredentialError);
    });
  });

  describe('security and integration aspects', () => {
    it('should maintain session-user relationship integrity', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      const registerResult = await register(userData, em);
      const loginResult = await login(userData, em);

      const user = await em.findOne(User, { id: loginResult.user.id }, { populate: ['sessions'] });
      expect(user!.sessions).toHaveLength(2);

      const sessionIds = user!.sessions.getItems().map((s) => s.user.id);
      expect(sessionIds.every((id) => id === registerResult.user.id)).toBe(true);
    });

    it('should create unique session IDs for multiple logins', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(userData, em);

      const firstLogin = await login(userData, em);
      const secondLogin = await login(userData, em);

      expect(firstLogin.sessionId).not.toBe(secondLogin.sessionId);

      const sessions = await em.find(Session, { user: { email: userData.email } });
      const sessionIds = sessions.map((s) => s.sessionId);
      const uniqueSessionIds = [...new Set(sessionIds)];
      expect(sessionIds).toHaveLength(uniqueSessionIds.length);
    });

    it('should persist login session to database correctly', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securepassword123',
      };

      const em = orm.em.fork();
      await register(userData, em);

      await login(userData, em);

      const sessionsFromDb = await em.find(Session, { user: { email: userData.email } });
      expect(sessionsFromDb).toHaveLength(2);

      const loginSession = sessionsFromDb.find((s) => s.sessionId !== sessionsFromDb[0].sessionId);
      expect(loginSession).toBeDefined();
      expect(loginSession!.user.email).toBe(userData.email);
      expect(loginSession!.expiresAt).toBeInstanceOf(Date);
    });
  });
});
