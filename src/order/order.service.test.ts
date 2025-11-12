import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { ORM } from '@/src/database.js';
import {
  createOrder,
  calculateOrderTotal,
  getOrderHistory,
  getOrderById,
} from '@/src/order/order.service.js';
import { Order, OrderStatus } from '@/src/order/order.entity.js';
import { OrderItem } from '@/src/order/order-item.entity.js';
import { Product } from '@/src/product/product.entity.js';
import { User } from '@/src/auth/user.entity.js';
import { Cart } from '@/src/cart/cart.entity.js';
import { CartItem } from '@/src/cart/cart-item.entity.js';
import { CartIsEmptyError, NoValidItemsSelectedError, OrderNotFoundError } from '@/src/error.js';
import { addToCart } from '@/src/cart/cart.service.js';
import { DatabaseSeeder } from '@/src/seeders/database.seeder.js';
import config from '@/src/mikro-orm.config.js';

describe('order service integration tests', () => {
  let orm: ORM;
  let testUser: User;
  let testUser2: User;
  let testProduct1: Product;
  let testProduct2: Product;
  let testProduct3: Product;

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

    await em.nativeDelete(OrderItem, {});
    await em.nativeDelete(Order, {});
    await em.nativeDelete(CartItem, {});
    await em.nativeDelete(Cart, {});
    await em.nativeDelete(User, {});

    testUser = new User();
    testUser.email = 'test@example.com';
    testUser.password = 'hashedpassword';
    em.persist(testUser);

    testUser2 = new User();
    testUser2.email = 'test2@example.com';
    testUser2.password = 'hashedpassword';
    em.persist(testUser2);

    const products = await em.find(Product, {}, { limit: 3 });
    testProduct1 = products[0];
    testProduct2 = products[1];
    testProduct3 = products[2];

    await em.flush();
    em.clear();
  });

  describe('createOrder', () => {
    describe('basic functionality', () => {
      it('should create order from cart items successfully', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);

        const orderResult = await createOrder(user, em);

        expect(orderResult).toBeDefined();
        expect(orderResult.id).toBeDefined();
        expect(orderResult.status).toBe(OrderStatus.PENDING);
        expect(orderResult.items).toHaveLength(2);
        expect(orderResult.total).toBe(product1.price * 2 + product2.price * 1);
        expect(orderResult.createdAt).toBeInstanceOf(Date);
        expect(orderResult.updatedAt).toBeInstanceOf(Date);
      });

      it('should create order with correct item details', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 3, em);

        const orderResult = await createOrder(user, em);

        expect(orderResult.items[0].quantity).toBe(3);
        expect(orderResult.items[0].price).toBe(product.price);
        expect(orderResult.items[0].product.id).toBe(product.id);
        expect(orderResult.items[0].product.name).toBe(product.name);
        expect(orderResult.items[0].subtotal).toBe(product.price * 3);
      });

      it('should persist order to database', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        const orderResult = await createOrder(user, em);

        const persistedOrder = await em.findOne(Order, orderResult.id, {
          populate: ['items', 'items.product'],
        });

        expect(persistedOrder).toBeDefined();
        expect(persistedOrder!.id).toBe(orderResult.id);
        expect(persistedOrder!.user.id).toBe(user.id);
        expect(persistedOrder!.items.length).toBe(1);
        expect(persistedOrder!.total).toBe(product.price * 2);
      });

      it('should clear cart after successful order creation', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);

        let cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        expect(cart!.items.length).toBe(1);

        await createOrder(user, em);

        cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        expect(cart!.items.length).toBe(0);
      });
    });

    describe('selective ordering with selectedItemIds', () => {
      it('should create order with only selected items', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);
        const product3 = await em.findOneOrFail(Product, testProduct3.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);
        await addToCart(user, product3.id, 1, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items'] });
        const cartItems = cart!.items.getItems();
        const selectedItemIds = [cartItems[0].id, cartItems[2].id];

        const orderResult = await createOrder(user, em, { selectedItemIds });

        expect(orderResult.items).toHaveLength(2);
        expect(orderResult.total).toBe(product1.price * 2 + product3.price * 1);

        const productIds = orderResult.items.map((item) => item.product.id);
        expect(productIds).toContain(product1.id);
        expect(productIds).toContain(product3.id);
        expect(productIds).not.toContain(product2.id);
      });

      it('should remove only selected items from cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);

        let cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        const cartItems = cart!.items.getItems();
        const product1Item = cartItems.find((item) => item.product.id === product1.id);
        const selectedItemIds = [product1Item!.id];

        await createOrder(user, em, { selectedItemIds });

        cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        expect(cart!.items.length).toBe(1);
        expect(cart!.items[0].product.id).toBe(product2.id);
      });
    });

    describe('error handling', () => {
      it('should throw CartIsEmptyError for empty cart', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        await expect(createOrder(user, em)).rejects.toThrow(CartIsEmptyError);
        await expect(createOrder(user, em)).rejects.toThrow('Cart is empty');
      });

      it('should throw NoValidItemsSelectedError when no valid items selected', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);

        const invalidItemIds = [99999];

        await expect(createOrder(user, em, { selectedItemIds: invalidItemIds })).rejects.toThrow(
          NoValidItemsSelectedError
        );
      });

      it('should throw NoValidItemsSelectedError with empty selectedItemIds array', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);

        await expect(createOrder(user, em, { selectedItemIds: [] })).rejects.toThrow(
          NoValidItemsSelectedError
        );
      });
    });

    describe('order calculations', () => {
      it('should calculate total correctly with multiple items and quantities', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 5, em);
        await addToCart(user, product2.id, 3, em);

        const orderResult = await createOrder(user, em);

        const expectedTotal = product1.price * 5 + product2.price * 3;
        expect(orderResult.total).toBe(expectedTotal);
        expect(orderResult.items[0].subtotal).toBe(product1.price * 5);
        expect(orderResult.items[1].subtotal).toBe(product2.price * 3);
      });

      it('should handle zero quantity items', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 0, em);

        const orderResult = await createOrder(user, em);

        expect(orderResult.items[0].quantity).toBe(0);
        expect(orderResult.items[0].subtotal).toBe(0);
        expect(orderResult.total).toBe(0);
      });
    });

    describe('timestamps and metadata', () => {
      it('should set correct timestamps on order creation', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);

        const beforeOrder = new Date();
        const orderResult = await createOrder(user, em);
        const afterOrder = new Date();

        expect(orderResult.createdAt.getTime()).toBeGreaterThanOrEqual(beforeOrder.getTime());
        expect(orderResult.createdAt.getTime()).toBeLessThanOrEqual(afterOrder.getTime());
        expect(orderResult.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeOrder.getTime());
        expect(orderResult.updatedAt.getTime()).toBeLessThanOrEqual(afterOrder.getTime());
      });

      it('should set default order status to PENDING', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);

        const orderResult = await createOrder(user, em);

        expect(orderResult.status).toBe(OrderStatus.PENDING);
      });
    });
  });

  describe('calculateOrderTotal', () => {
    describe('basic functionality', () => {
      it('should calculate total for single item', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 3, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        const cartItems = cart!.items.getItems();

        const total = calculateOrderTotal(cartItems);

        expect(total).toBe(product.price * 3);
      });

      it('should calculate total for multiple items', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 4, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        const cartItems = cart!.items.getItems();

        const total = calculateOrderTotal(cartItems);

        const expectedTotal = product1.price * 2 + product2.price * 4;
        expect(total).toBe(expectedTotal);
      });

      it('should return zero for empty cart items array', () => {
        const total = calculateOrderTotal([]);
        expect(total).toBe(0);
      });

      it('should handle items with zero quantity', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 0, em);
        await addToCart(user, product2.id, 2, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        const cartItems = cart!.items.getItems();

        const total = calculateOrderTotal(cartItems);

        expect(total).toBe(product2.price * 2);
      });
    });

    describe('precision and edge cases', () => {
      it('should maintain precision with decimal prices', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const product = await em.findOneOrFail(Product, testProduct1.id);
        product.price = 19.99;
        await em.flush();

        await addToCart(user, product.id, 3, em);

        const cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
        const cartItems = cart!.items.getItems();

        const total = calculateOrderTotal(cartItems);

        expect(total).toBe(59.97);
      });
    });
  });

  describe('getOrderHistory', () => {
    describe('basic functionality', () => {
      it('should return paginated order history for user', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);
        await createOrder(user, em);

        await addToCart(user, product.id, 2, em);
        await createOrder(user, em);

        const historyResult = await getOrderHistory(user, em);

        expect(historyResult.orders).toHaveLength(2);
        expect(historyResult.total).toBe(2);
        expect(historyResult.page).toBe(1);
        expect(historyResult.totalPages).toBe(1);
      });

      it('should return orders with populated items and products', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);
        await createOrder(user, em);

        const historyResult = await getOrderHistory(user, em);

        expect(historyResult.orders[0].items).toHaveLength(2);
        expect(historyResult.orders[0].items[0].product.name).toBeDefined();
        expect(historyResult.orders[0].items[0].quantity).toBeDefined();
        expect(historyResult.orders[0].items[0].price).toBeDefined();
        expect(historyResult.orders[0].items[0].subtotal).toBeDefined();
      });

      it('should calculate subtotals correctly in order history', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 3, em);
        await createOrder(user, em);

        const historyResult = await getOrderHistory(user, em);

        expect(historyResult.orders[0].items[0].subtotal).toBe(product.price * 3);
        expect(historyResult.orders[0].total).toBe(product.price * 3);
      });

      it('should return empty result for user with no orders', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const historyResult = await getOrderHistory(user, em);

        expect(historyResult.orders).toHaveLength(0);
        expect(historyResult.total).toBe(0);
        expect(historyResult.page).toBe(1);
        expect(historyResult.totalPages).toBe(0);
      });

      it('should order by createdAt DESC (newest first)', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);
        const firstOrder = await createOrder(user, em);

        await new Promise((resolve) => setTimeout(resolve, 10));

        await addToCart(user, product.id, 2, em);
        const secondOrder = await createOrder(user, em);

        const historyResult = await getOrderHistory(user, em);

        expect(historyResult.orders[0].id).toBe(secondOrder.id);
        expect(historyResult.orders[1].id).toBe(firstOrder.id);
        expect(historyResult.orders[0].createdAt.getTime()).toBeGreaterThan(
          historyResult.orders[1].createdAt.getTime()
        );
      });
    });

    describe('pagination', () => {
      beforeEach(async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        for (let i = 0; i < 5; i++) {
          await addToCart(user, product.id, 1, em);
          await createOrder(user, em);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      });

      it('should handle page size correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const historyResult = await getOrderHistory(user, em, 1, 3);

        expect(historyResult.orders).toHaveLength(3);
        expect(historyResult.total).toBe(5);
        expect(historyResult.page).toBe(1);
        expect(historyResult.totalPages).toBe(2);
      });

      it('should handle second page correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const historyResult = await getOrderHistory(user, em, 2, 3);

        expect(historyResult.orders).toHaveLength(2);
        expect(historyResult.total).toBe(5);
        expect(historyResult.page).toBe(2);
        expect(historyResult.totalPages).toBe(2);
      });

      it('should handle page beyond available data', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const historyResult = await getOrderHistory(user, em, 10, 3);

        expect(historyResult.orders).toHaveLength(0);
        expect(historyResult.total).toBe(5);
        expect(historyResult.page).toBe(10);
        expect(historyResult.totalPages).toBe(2);
      });

      it('should handle default pagination parameters', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });

        const historyResult = await getOrderHistory(user, em);

        expect(historyResult.orders).toHaveLength(5);
        expect(historyResult.page).toBe(1);
        expect(historyResult.totalPages).toBe(1);
      });
    });

    describe('user isolation', () => {
      it('should only return orders for the specified user', async () => {
        const em = orm.em.fork();
        const user1 = await em.findOneOrFail(User, { email: 'test@example.com' });
        const user2 = await em.findOneOrFail(User, { email: 'test2@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user1, product.id, 1, em);
        await createOrder(user1, em);

        await addToCart(user2, product.id, 2, em);
        await createOrder(user2, em);

        const user1History = await getOrderHistory(user1, em);
        const user2History = await getOrderHistory(user2, em);

        expect(user1History.orders).toHaveLength(1);
        expect(user2History.orders).toHaveLength(1);
        expect(user1History.orders[0].items[0].quantity).toBe(1);
        expect(user2History.orders[0].items[0].quantity).toBe(2);
      });
    });

    describe('data integrity', () => {
      it('should maintain consistent timestamps', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);
        await createOrder(user, em);

        const historyResult = await getOrderHistory(user, em);

        const order = historyResult.orders[0];
        expect(order.createdAt).toBeInstanceOf(Date);
        expect(order.updatedAt).toBeInstanceOf(Date);
        expect(order.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
        expect(order.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
      });
    });
  });

  describe('getOrderById', () => {
    describe('basic functionality', () => {
      it('should retrieve order by ID successfully', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 2, em);
        const createdOrder = await createOrder(user, em);

        const retrievedOrder = await getOrderById(createdOrder.id, user, em);

        expect(retrievedOrder.id).toBe(createdOrder.id);
        expect(retrievedOrder.total).toBe(createdOrder.total);
        expect(retrievedOrder.status).toBe(createdOrder.status);
        expect(retrievedOrder.items).toHaveLength(1);
      });

      it('should populate items and products correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 1, em);
        const createdOrder = await createOrder(user, em);

        const retrievedOrder = await getOrderById(createdOrder.id, user, em);

        expect(retrievedOrder.items).toHaveLength(2);
        expect(retrievedOrder.items[0].product.name).toBeDefined();
        expect(retrievedOrder.items[0].product.description).toBeDefined();
        expect(retrievedOrder.items[0].quantity).toBeDefined();
        expect(retrievedOrder.items[0].price).toBeDefined();
        expect(retrievedOrder.items[0].subtotal).toBeDefined();
      });

      it('should calculate subtotals correctly', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 4, em);
        const createdOrder = await createOrder(user, em);

        const retrievedOrder = await getOrderById(createdOrder.id, user, em);

        expect(retrievedOrder.items[0].subtotal).toBe(product.price * 4);
        expect(retrievedOrder.items[0].quantity).toBe(4);
        expect(retrievedOrder.items[0].price).toBe(product.price);
        expect(retrievedOrder.total).toBe(product.price * 4);
      });

      it('should maintain data consistency with creation', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 3, em);
        const createdOrder = await createOrder(user, em);

        const retrievedOrder = await getOrderById(createdOrder.id, user, em);

        expect(retrievedOrder.id).toBe(createdOrder.id);
        expect(retrievedOrder.total).toBe(createdOrder.total);
        expect(retrievedOrder.status).toBe(createdOrder.status);
        expect(retrievedOrder.createdAt.getTime()).toBe(createdOrder.createdAt.getTime());
        expect(retrievedOrder.updatedAt.getTime()).toBe(createdOrder.updatedAt.getTime());
        expect(retrievedOrder.items[0].product.id).toBe(createdOrder.items[0].product.id);
      });
    });

    describe('error handling', () => {
      it('should throw OrderNotFoundError for non-existent order', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const nonExistentOrderId = 99999;

        await expect(getOrderById(nonExistentOrderId, user, em)).rejects.toThrow(
          OrderNotFoundError
        );
        await expect(getOrderById(nonExistentOrderId, user, em)).rejects.toThrow('Order not found');
      });

      it("should throw OrderNotFoundError when accessing another user's order", async () => {
        const em = orm.em.fork();
        const user1 = await em.findOneOrFail(User, { email: 'test@example.com' });
        const user2 = await em.findOneOrFail(User, { email: 'test2@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user1, product.id, 1, em);
        const user1Order = await createOrder(user1, em);

        await expect(getOrderById(user1Order.id, user2, em)).rejects.toThrow(OrderNotFoundError);
      });
    });

    describe('user isolation', () => {
      it('should only allow access to own orders', async () => {
        const em = orm.em.fork();
        const user1 = await em.findOneOrFail(User, { email: 'test@example.com' });
        const user2 = await em.findOneOrFail(User, { email: 'test2@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user1, product.id, 1, em);
        const user1Order = await createOrder(user1, em);

        await addToCart(user2, product.id, 2, em);
        const user2Order = await createOrder(user2, em);

        const retrievedUser1Order = await getOrderById(user1Order.id, user1, em);
        const retrievedUser2Order = await getOrderById(user2Order.id, user2, em);

        expect(retrievedUser1Order.id).toBe(user1Order.id);
        expect(retrievedUser1Order.items[0].quantity).toBe(1);
        expect(retrievedUser2Order.id).toBe(user2Order.id);
        expect(retrievedUser2Order.items[0].quantity).toBe(2);

        await expect(getOrderById(user2Order.id, user1, em)).rejects.toThrow(OrderNotFoundError);
        await expect(getOrderById(user1Order.id, user2, em)).rejects.toThrow(OrderNotFoundError);
      });
    });

    describe('data integrity', () => {
      it('should return consistent timestamps', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product = await em.findOneOrFail(Product, testProduct1.id);

        await addToCart(user, product.id, 1, em);
        const createdOrder = await createOrder(user, em);

        const retrievedOrder = await getOrderById(createdOrder.id, user, em);

        expect(retrievedOrder.createdAt).toBeInstanceOf(Date);
        expect(retrievedOrder.updatedAt).toBeInstanceOf(Date);
        expect(retrievedOrder.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
        expect(retrievedOrder.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('should maintain item order consistency', async () => {
        const em = orm.em.fork();
        const user = await em.findOneOrFail(User, { email: 'test@example.com' });
        const product1 = await em.findOneOrFail(Product, testProduct1.id);
        const product2 = await em.findOneOrFail(Product, testProduct2.id);

        await addToCart(user, product1.id, 2, em);
        await addToCart(user, product2.id, 3, em);
        const createdOrder = await createOrder(user, em);

        const retrievedOrder = await getOrderById(createdOrder.id, user, em);

        expect(retrievedOrder.items).toHaveLength(2);
        const productIds = retrievedOrder.items.map((item) => item.product.id);
        expect(productIds).toContain(product1.id);
        expect(productIds).toContain(product2.id);
      });
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple users creating orders simultaneously', async () => {
      const em1 = orm.em.fork();
      const em2 = orm.em.fork();

      const user1 = await em1.findOneOrFail(User, { email: 'test@example.com' });
      const user2 = await em2.findOneOrFail(User, { email: 'test2@example.com' });
      const product = await em1.findOneOrFail(Product, testProduct1.id);

      await addToCart(user1, product.id, 2, em1);
      await addToCart(user2, product.id, 3, em2);

      const [order1, order2] = await Promise.all([
        createOrder(user1, em1),
        createOrder(user2, em2),
      ]);

      expect(order1.items[0].quantity).toBe(2);
      expect(order2.items[0].quantity).toBe(3);
      expect(order1.id).not.toBe(order2.id);
    });

    it('should handle concurrent order operations for same user', async () => {
      const em = orm.em.fork();
      const user = await em.findOneOrFail(User, { email: 'test@example.com' });
      const product1 = await em.findOneOrFail(Product, testProduct1.id);
      const product2 = await em.findOneOrFail(Product, testProduct2.id);

      await addToCart(user, product1.id, 2, em);
      const order1 = await createOrder(user, em);

      await addToCart(user, product2.id, 1, em);
      const order2 = await createOrder(user, em);

      const [retrievedOrder1, retrievedOrder2] = await Promise.all([
        getOrderById(order1.id, user, em),
        getOrderById(order2.id, user, em),
      ]);

      expect(retrievedOrder1.id).toBe(order1.id);
      expect(retrievedOrder2.id).toBe(order2.id);
      expect(retrievedOrder1.items[0].product.id).toBe(product1.id);
      expect(retrievedOrder2.items[0].product.id).toBe(product2.id);
    });

    it('should handle concurrent history requests', async () => {
      const em = orm.em.fork();
      const user = await em.findOneOrFail(User, { email: 'test@example.com' });
      const product = await em.findOneOrFail(Product, testProduct1.id);

      for (let i = 0; i < 3; i++) {
        await addToCart(user, product.id, 1, em);
        await createOrder(user, em);
      }

      const [history1, history2, history3] = await Promise.all([
        getOrderHistory(user, em, 1, 2),
        getOrderHistory(user, em, 2, 2),
        getOrderHistory(user, em),
      ]);

      expect(history1.orders).toHaveLength(2);
      expect(history2.orders).toHaveLength(1);
      expect(history3.orders).toHaveLength(3);
      expect(history1.totalPages).toBe(2);
      expect(history2.totalPages).toBe(2);
      expect(history3.totalPages).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete order workflow', async () => {
      const em = orm.em.fork();
      const user = await em.findOneOrFail(User, { email: 'test@example.com' });
      const product1 = await em.findOneOrFail(Product, testProduct1.id);
      const product2 = await em.findOneOrFail(Product, testProduct2.id);

      await addToCart(user, product1.id, 2, em);
      await addToCart(user, product2.id, 1, em);

      const expectedTotal = calculateOrderTotal([
        { quantity: 2, product: { price: product1.price } },
        { quantity: 1, product: { price: product2.price } },
      ] as any);

      const createdOrder = await createOrder(user, em);

      expect(createdOrder.total).toBe(expectedTotal);
      expect(createdOrder.status).toBe(OrderStatus.PENDING);

      const retrievedOrder = await getOrderById(createdOrder.id, user, em);
      expect(retrievedOrder.id).toBe(createdOrder.id);
      expect(retrievedOrder.total).toBe(expectedTotal);

      const orderHistory = await getOrderHistory(user, em);
      expect(orderHistory.orders).toHaveLength(1);
      expect(orderHistory.orders[0].id).toBe(createdOrder.id);
    });

    it('should handle selective ordering and cart state', async () => {
      const em = orm.em.fork();
      const user = await em.findOneOrFail(User, { email: 'test@example.com' });
      const product1 = await em.findOneOrFail(Product, testProduct1.id);
      const product2 = await em.findOneOrFail(Product, testProduct2.id);
      const product3 = await em.findOneOrFail(Product, testProduct3.id);

      await addToCart(user, product1.id, 2, em);
      await addToCart(user, product2.id, 1, em);
      await addToCart(user, product3.id, 3, em);

      let cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
      const cartItems = cart!.items.getItems();
      const selectedItems = cartItems.filter(
        (item) => item.product.id === product1.id || item.product.id === product3.id
      );
      const selectedItemIds = selectedItems.map((item) => item.id);

      const createdOrder = await createOrder(user, em, { selectedItemIds });

      expect(createdOrder.items).toHaveLength(2);
      expect(createdOrder.total).toBe(product1.price * 2 + product3.price * 3);

      cart = await em.findOne(Cart, { user }, { populate: ['items', 'items.product'] });
      expect(cart!.items.length).toBe(1);
      expect(cart!.items[0].product.id).toBe(product2.id);

      const orderHistory = await getOrderHistory(user, em);
      expect(orderHistory.orders[0].items).toHaveLength(2);

      const productIds = orderHistory.orders[0].items.map((item) => item.product.id);
      expect(productIds).toContain(product1.id);
      expect(productIds).toContain(product3.id);
      expect(productIds).not.toContain(product2.id);
    });

    it('should handle edge cases and error recovery', async () => {
      const em = orm.em.fork();
      const user = await em.findOneOrFail(User, { email: 'test@example.com' });

      await expect(createOrder(user, em)).rejects.toThrow(CartIsEmptyError);

      const product = await em.findOneOrFail(Product, testProduct1.id);
      await addToCart(user, product.id, 1, em);

      const createdOrder = await createOrder(user, em);
      expect(createdOrder).toBeDefined();

      await expect(getOrderById(99999, user, em)).rejects.toThrow(OrderNotFoundError);

      const retrievedOrder = await getOrderById(createdOrder.id, user, em);
      expect(retrievedOrder.id).toBe(createdOrder.id);

      const historyEmpty = await getOrderHistory(
        await em.findOneOrFail(User, { email: 'test2@example.com' }),
        em
      );
      expect(historyEmpty.orders).toHaveLength(0);

      const historyWithOrders = await getOrderHistory(user, em);
      expect(historyWithOrders.orders).toHaveLength(1);
    });
  });
});
