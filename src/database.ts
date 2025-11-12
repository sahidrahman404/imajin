import { MikroORM } from '@mikro-orm/better-sqlite';

export async function initORM() {
  const orm = await MikroORM.init();

  return {
    orm,
    em: orm.em,
  };
}

export const db = await initORM();

export type ORM = (typeof db)['orm'];
