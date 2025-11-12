import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { type User } from './user.entity.js';
import { User as UserEntity } from './user.entity.js';

@Entity()
export class Session {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true, type: 'string' })
  sessionId!: string;

  @ManyToOne(() => UserEntity)
  user!: User;

  @Property()
  expiresAt!: Date;

  @Property()
  createdAt: Date = new Date();
}
