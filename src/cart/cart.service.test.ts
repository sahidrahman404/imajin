import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { ORM } from '../database.js';
import {
  getOrCreateCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  getCartWithItems,
  clearCart,
  getCartItems,
} from './cart.service.js';
import { Cart } from './cart.entity.js';
import { CartItem } from './cart-item.entity.js';
import { Product } from '../product/product.entity.js';
import { User } from '../auth/user.entity.js';
import {
  CartNotFoundError,
  ItemNotFoundInTheCartError,
  ProductNotFoundError,
} from '../error.js';
import { DatabaseSeeder } from '../seeders/database.seeder.js';
import config from '../mikro-orm.config.js';

describe('cart service integration tests', () => {
  let orm: ORM;
  let testUser: User;
  let testProduct1: Product;
  let testProduct2: Product;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...config,
      dbName: ':memory:',
      debug: false,
    });

    await orm.schema.refreshDatabase();
    await orm.seeder.seed(DatabaseSeeder);
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    const em = orm.em.fork();

    await em.nativeDelete(CartItem, {});
    await em.nativeDelete(Cart, {});
    await em.nativeDelete(User, {});

    testUser = new User();
    testUser.email = 'test@example.com';
    testUser.password = 'hashedpassword';
    em.persist(testUser);

    const products = await em.find(Product, {}, { limit: 2 });
    testProduct1 = products[0];
    testProduct2 = products[1];

    await em.flush();
    em.clear();
  });

  describe('getOrCreateCart', () => {
    describe('basic functionality', () => {
      it('should create new cart for user without cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const cart = await getOrCreateCart(user, em);

        expect(cart).toBeDefined();
        expect(cart.id).toBeDefined();
        expect(cart.user.id).toBe(user.id);
        expect(cart.createdAt).toBeInstanceOf(Date);
        expect(cart.updatedAt).toBeInstanceOf(Date);
      });

      it('should return existing cart for user with cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const firstCart = await getOrCreateCart(user, em);
        const secondCart = await getOrCreateCart(user, em);

        expect(firstCart.id).toBe(secondCart.id);
        expect(firstCart.createdAt.getTime()).toBe(secondCart.createdAt.getTime());
      });

      it('should persist cart to database', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const cart = await getOrCreateCart(user, em);
        const persistedCart = await em.findOne(Cart, cart.id);

        expect(persistedCart).toBeDefined();
        expect(persistedCart!.id).toBe(cart.id);
        expect(persistedCart!.user.id).toBe(user.id);
      });
    });

    describe('concurrent operations', () => {
      it('should handle multiple concurrent calls', async () => {
        const em1 = orm.em.fork();
        const em2 = orm.em.fork();
        const user1 = await em1.findOneOrFail(User, { email: 'test@example.com' });
        const user2 = await em2.findOneOrFail(User, { email: 'test@example.com' });

        const [cart1, cart2] = await Promise.all([
          getOrCreateCart(user1, em1),
          getOrCreateCart(user2, em2),
        ]);

        expect(cart1.user.id).toBe(cart2.user.id);
        expect(cart1.user.id).toBe(user1.id);
        expect(cart2.user.id).toBe(user2.id);
      });
    });
  });

  describe('addToCart', () => {
    describe('basic functionality', () => {
      it('should add new product to empty cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        expect(cart).toBeDefined();
        expect(cart!.items.length).toBe(1);
        expect(cart!.items[0].product.id).toBe(product.id);
        expect(cart!.items[0].quantity).toBe(2);
      });

      it('should increment quantity for existing product', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);
        await addToCart(user, product.id, 3, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        expect(cart!.items.length).toBe(1);
        expect(cart!.items[0].quantity).toBe(5);
      });

      it('should add multiple different products', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        expect(cart!.items.length).toBe(2);

        const productIds = cart!.items.getItems().map((item) => item.product.id);
        expect(productIds).toContain(product1.id);
        expect(productIds).toContain(product2.id);
      });

      it('should update updatedAt timestamp when adding to existing item', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        const firstUpdatedAt = cart!.items[0].updatedAt;

        await new Promise((resolve) => setTimeout(resolve, 10));

        await addToCart(user, product.id, 1, em);

        const updatedCart = await em.findOne(Cart, { user }, { populate: ['items'] });
        const secondUpdatedAt = updatedCart!.items[0].updatedAt;

        expect(secondUpdatedAt.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
      });
    });

    describe('error handling', () => {
      it('should throw ProductNotFoundError for non-existent product', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const nonExistentProductId = 99999;

        await expect(addToCart(user, nonExistentProductId, 1, em)).rejects.toThrow(
          ProductNotFoundError
        );
        await expect(addToCart(user, nonExistentProductId, 1, em)).rejects.toThrow(
          'Product not found'
        );
      });

      it('should handle zero quantity', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 0, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        expect(cart!.items.length).toBe(1);
        expect(cart!.items[0].quantity).toBe(0);
      });
    });
  });

  describe('updateCartItem', () => {
    describe('basic functionality', () => {
      it('should update item quantity successfully', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);
        await updateCartItem(user, product.id, 5, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        expect(cart!.items[0].quantity).toBe(5);
      });

      it('should update updatedAt timestamp', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        const originalUpdatedAt = cart!.items[0].updatedAt;

        await new Promise((resolve) => setTimeout(resolve, 10));

        await updateCartItem(user, product.id, 3, em);

        const updatedCart = await em.findOne(Cart, { user }, { populate: ['items'] });
        const newUpdatedAt = updatedCart!.items[0].updatedAt;

        expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });
    });

    describe('error handling', () => {
      it('should throw CartNotFoundError for non-existent cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await expect(updateCartItem(user, product.id, 5, em)).rejects.toThrow(CartNotFoundError);
      });

      it('should throw ItemNotFoundInTheCartError for non-existent item', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);

        await expect(updateCartItem(user, product2.id, 5, em)).rejects.toThrow(
          ItemNotFoundInTheCartError
        );
      });
    });
  });

  describe('removeFromCart', () => {
    describe('basic functionality', () => {
      it('should remove item from cart successfully', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);
        await removeFromCart(user, product1.id, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        expect(cart!.items.length).toBe(1);
        expect(cart!.items[0].product.id).toBe(product2.id);
      });

      it('should remove item completely from database', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const cartBefore = await em.findOne(Cart, { user }, { populate: ['items'] });
        const itemId = cartBefore!.items[0].id;

        await removeFromCart(user, product.id, em);

        const removedItem = await em.findOne(CartItem, itemId);
        expect(removedItem).toBeNull();
      });
    });

    describe('error handling', () => {
      it('should throw CartNotFoundError for non-existent cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await expect(removeFromCart(user, product.id, em)).rejects.toThrow(CartNotFoundError);
      });

      it('should throw ItemNotFoundInTheCartError for non-existent item', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);

        await expect(removeFromCart(user, product2.id, em)).rejects.toThrow(
          ItemNotFoundInTheCartError
        );
      });
    });
  });

  describe('getCartWithItems', () => {
    describe('basic functionality', () => {
      it('should return cart with populated items and calculations', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);

        const cartWithItems = await getCartWithItems(user, em);

        expect(cartWithItems.id).toBeDefined();
        expect(cartWithItems.items).toHaveLength(2);
        expect(cartWithItems.itemCount).toBe(3);

        const expectedTotal = product1.price * 2 + product2.price * 1;
        expect(cartWithItems.total).toBe(expectedTotal);
      });

      it('should create new cart if none exists', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const cartWithItems = await getCartWithItems(user, em);

        expect(cartWithItems.id).toBeDefined();
        expect(cartWithItems.items).toHaveLength(0);
        expect(cartWithItems.total).toBe(0);
        expect(cartWithItems.itemCount).toBe(0);
        expect(cartWithItems.createdAt).toBeInstanceOf(Date);
        expect(cartWithItems.updatedAt).toBeInstanceOf(Date);
      });

      it('should calculate subtotals correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 3, em);

        const cartWithItems = await getCartWithItems(user, em);

        expect(cartWithItems.items[0].subtotal).toBe(product.price * 3);
        expect(cartWithItems.items[0].quantity).toBe(3);
        expect(cartWithItems.items[0].product.id).toBe(product.id);
        expect(cartWithItems.items[0].product.name).toBe(product.name);
        expect(cartWithItems.items[0].product.price).toBe(product.price);
      });

      it('should handle empty cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        await getOrCreateCart(user, em);

        const cartWithItems = await getCartWithItems(user, em);

        expect(cartWithItems.items).toHaveLength(0);
        expect(cartWithItems.total).toBe(0);
        expect(cartWithItems.itemCount).toBe(0);
      });
    });

    describe('calculations', () => {
      it('should calculate total correctly with multiple items', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 3, em);

        const cartWithItems = await getCartWithItems(user, em);

        const expectedTotal = product1.price * 2 + product2.price * 3;
        expect(cartWithItems.total).toBe(expectedTotal);
      });

      it('should calculate item count correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 5, em);
        await addToCart(user, product2.id, 2, em);

        const cartWithItems = await getCartWithItems(user, em);

        expect(cartWithItems.itemCount).toBe(7);
      });
    });
  });

  describe('clearCart', () => {
    describe('basic functionality', () => {
      it('should remove all items from cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);

        let cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        expect(cart!.items.length).toBe(2);

        await clearCart(user, em);

        cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        expect(cart!.items.length).toBe(0);
      });

      it('should handle non-existent cart gracefully', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        await expect(clearCart(user, em)).resolves.not.toThrow();
      });

      it('should preserve cart entity while removing items', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const cartBefore = await em.findOne(Cart, { user });
        const cartId = cartBefore!.id;

        await clearCart(user, em);

        const cartAfter = await em.findOne(Cart, cartId);
        expect(cartAfter).toBeDefined();
        expect(cartAfter!.id).toBe(cartId);
      });

      it('should remove items from database completely', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const cartBefore = await em.findOne(Cart, { user }, { populate: ['items'] });
        const itemIds = cartBefore!.items.getItems().map((item) => item.id);

        await clearCart(user, em);

        for (const itemId of itemIds) {
          const removedItem = await em.findOne(CartItem, itemId);
          expect(removedItem).toBeNull();
        }
      });
    });
  });

  describe('getCartItems', () => {
    describe('basic functionality', () => {
      it('should return cart items with product data', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);

        const cartItems = await getCartItems(user, em);

        expect(cartItems).toHaveLength(2);
        expect(cartItems[0].quantity).toBeDefined();
        expect(cartItems[0].product).toBeDefined();
        expect(cartItems[0].product.name).toBeDefined();
        expect(cartItems[0].product.price).toBeDefined();
      });

      it('should return empty array for non-existent cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const cartItems = await getCartItems(user, em);

        expect(cartItems).toHaveLength(0);
        expect(Array.isArray(cartItems)).toBe(true);
      });

      it('should populate product relationships correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 3, em);

        const cartItems = await getCartItems(user, em);

        expect(cartItems[0].product.id).toBe(product.id);
        expect(cartItems[0].product.name).toBe(product.name);
        expect(cartItems[0].product.price).toBe(product.price);
        expect(cartItems[0].quantity).toBe(3);
      });
    });

    describe('data integrity', () => {
      it('should maintain consistent data across multiple calls', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const firstCall = await getCartItems(user, em);
        const secondCall = await getCartItems(user, em);

        expect(firstCall.length).toBe(secondCall.length);
        expect(firstCall[0].id).toBe(secondCall[0].id);
        expect(firstCall[0].quantity).toBe(secondCall[0].quantity);
        expect(firstCall[0].product.id).toBe(secondCall[0].product.id);
      });

      it('should return items with proper timestamps', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);

        const cartItems = await getCartItems(user, em);

        expect(cartItems[0].createdAt).toBeInstanceOf(Date);
        expect(cartItems[0].updatedAt).toBeInstanceOf(Date);
        expect(cartItems[0].createdAt.getTime()).toBeLessThanOrEqual(Date.now());
        expect(cartItems[0].updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
      });
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple users accessing cart functions simultaneously', async () => {
      const em1 = orm.em.fork();
      const em2 = orm.em.fork();

      const testUser2 = new User();
      testUser2.email = 'test2@example.com';
      testUser2.password = 'hashedpassword';
      em1.persist(testUser2);
      await em1.flush();

      const user1 = await em1.findOneOrFail(User, { email: 'test@example.com' });
      const user2 = await em2.findOneOrFail(User, { email: 'test2@example.com' });
      const product = await em1.findOneOrFail(Product, testProduct1.id);

      await Promise.all([
        addToCart(user1, product.id, 2, em1),
        addToCart(user2, product.id, 3, em2),
      ]);

      const [cartItems1, cartItems2] = await Promise.all([
        getCartItems(user1, em1),
        getCartItems(user2, em2),
      ]);

      expect(cartItems1[0].quantity).toBe(2);
      expect(cartItems2[0].quantity).toBe(3);
    });

    it('should handle concurrent cart operations for same user', async () => {
      const em = orm.em.fork();
      const user = await em.findOneOrFail(User, { email: 'test@example.com' });
      const product1 = await em.findOneOrFail(Product, testProduct1.id);
      const product2 = await em.findOneOrFail(Product, testProduct2.id);

      await addToCart(user, product1.id, 2, em);
      await addToCart(user, product2.id, 1, em);

      const cartItems = await getCartItems(user, em);
      expect(cartItems.length).toBe(2);

      const productIds = cartItems.map((item) => item.product.id);
      expect(productIds).toContain(product1.id);
      expect(productIds).toContain(product2.id);
    });
  });
});
