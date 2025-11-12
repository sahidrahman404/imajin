import { MikroORM } from '@mikro-orm/better-sqlite';
import config from './mikro-orm.config.js';

export async function initORM() {
  const orm = await MikroORM.init({ ...config });

  return {
    orm,
    em: orm.em,
  };
}

export const db = await initORM();

export type ORM = (typeof db)['orm'];
