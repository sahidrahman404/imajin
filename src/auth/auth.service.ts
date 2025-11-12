import { hash, verify } from '@node-rs/argon2';
import { User } from './user.entity.js';
import { createSession } from './session.service.js';
import { ConstraintViolationException, type EntityManager } from '@mikro-orm/core';
import { EmailConflictError, InvalidCredentialError } from '../error.js';

export interface RegisterData {
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export async function register(
  data: RegisterData,
  em: EntityManager
): Promise<{ user: User; sessionId: string }> {
  try {
    return await em.transactional(async (em) => {
      const hashedPassword = await hash(data.password);

      const user = new User();
      user.email = data.email;
      user.password = hashedPassword;

      const sessionId = await createSession(user, em);

      return { user, sessionId };
    });
  } catch (error: unknown) {
    if (error instanceof ConstraintViolationException) {
      throw new EmailConflictError();
    }
    throw error;
  }
}

export async function login(
  data: LoginData,
  em: EntityManager
): Promise<{ user: User; sessionId: string }> {
  const user = await em.findOne(User, { email: data.email });
  if (!user) {
    throw new InvalidCredentialError();
  }

  const isValidPassword = await verify(user.password, data.password);
  if (!isValidPassword) {
    throw new InvalidCredentialError();
  }

  const sessionId = await createSession(user, em);
  console.log(sessionId);

  return { user, sessionId };
}
