import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { BetterSqliteDriver, type Options } from '@mikro-orm/better-sqlite';
import { User } from './auth/user.entity.js';
import { Session } from './auth/session.entity.js';
import { Cart } from './cart/cart.entity.js';
import { CartItem } from './cart/cart-item.entity.js';
import { Product } from './product/product.entity.js';
import { Category } from './category/category.entity.js';
import { Order } from './order/order.entity.js';
import { OrderItem } from './order/order-item.entity.js';

const config: Options = {
  driver: BetterSqliteDriver,
  dbName: 'sqlite.db',
  entities: [User, Session, Cart, CartItem, Product, Category, Order, OrderItem],
  metadataProvider: TsMorphMetadataProvider,
  debug: true,
  extensions: [Migrator, SeedManager],
  seeder: {
    path: 'dist/seeders',
    pathTs: 'src/seeders',
    defaultSeeder: 'DatabaseSeeder',
    glob: '!(*.d).{js,ts}',
    emit: 'ts',
  },
};

export default config;
