import type { EntityManager } from '@mikro-orm/core';
import { Order, OrderStatus } from './order.entity.js';
import { OrderItem } from './order-item.entity.js';
import { User } from '../auth/user.entity.js';
import { CartIsEmptyError, NoValidItemsSelectedError, OrderNotFoundError } from '../error.js';
import { getCartItems, clearCart } from '../cart/cart.service.js';
import type { CartItem } from '../cart/cart-item.entity.js';

export interface CreateOrderOptions {
  selectedItemIds?: number[];
}

export interface OrderWithItems {
  id: number;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    quantity: number;
    price: number;
    product: {
      id: number;
      name: string;
      description?: string;
    };
    subtotal: number;
  }>;
}

export interface OrderHistoryResult {
  orders: OrderWithItems[];
  total: number;
  page: number;
  totalPages: number;
}

export async function createOrder(
  user: User,
  em: EntityManager,
  options: CreateOrderOptions = {}
): Promise<OrderWithItems> {
  const cartItems = await getCartItems(user, em);
  if (cartItems.length === 0) {
    throw new CartIsEmptyError();
  }

  let itemsToOrder: CartItem[] = cartItems;

  if (options.selectedItemIds) {
    itemsToOrder = cartItems.filter((item) => options.selectedItemIds!.includes(item.id));

    if (itemsToOrder.length === 0) {
      throw new NoValidItemsSelectedError();
    }
  }

  const total = calculateOrderTotal(itemsToOrder);

  const order = new Order();
  order.user = user;
  order.total = total;
  order.status = OrderStatus.PENDING;

  em.persist(order);

  const orderItems = itemsToOrder.map((cartItem) => {
    const orderItem = new OrderItem();
    orderItem.order = order;
    orderItem.product = cartItem.product;
    orderItem.quantity = cartItem.quantity;
    orderItem.price = cartItem.product.price;
    em.persist(orderItem);
    return orderItem;
  });

  await em.flush();

  if (!options.selectedItemIds) {
    await clearCart(user, em);
  } else {
    for (const cartItem of itemsToOrder) {
      em.remove(cartItem);
    }
    await em.flush();
  }

  return {
    id: order.id,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: orderItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      product: {
        id: item.product.id,
        name: item.product.name,
        description: item.product.description,
      },
      subtotal: item.quantity * item.price,
    })),
  };
}

export function calculateOrderTotal(cartItems: CartItem[]): number {
  return cartItems.reduce((total, item) => {
    return total + item.quantity * item.product.price;
  }, 0);
}

export async function getOrderHistory(
  user: User,
  em: EntityManager,
  page: number = 1,
  pageSize: number = 10
): Promise<OrderHistoryResult> {
  const offset = (page - 1) * pageSize;

  const [orders, total] = await Promise.all([
    em.find(
      Order,
      { user: user },
      {
        populate: ['items', 'items.product'],
        orderBy: { createdAt: 'DESC' },
        limit: pageSize,
        offset,
      }
    ),
    em.count(Order, { user: user }),
  ]);

  const ordersWithItems: OrderWithItems[] = orders.map((order) => ({
    id: order.id,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.getItems().map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      product: {
        id: item.product.id,
        name: item.product.name,
        description: item.product.description,
      },
      subtotal: item.quantity * item.price,
    })),
  }));

  const totalPages = Math.ceil(total / pageSize);

  return {
    orders: ordersWithItems,
    total,
    page,
    totalPages,
  };
}

export async function getOrderById(
  orderId: number,
  user: User,
  em: EntityManager
): Promise<OrderWithItems> {
  const order = await em.findOne(
    Order,
    { id: orderId, user: user },
    { populate: ['items', 'items.product'] }
  );

  if (!order) {
    throw new OrderNotFoundError();
  }

  return {
    id: order.id,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.getItems().map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      product: {
        id: item.product.id,
        name: item.product.name,
        description: item.product.description,
      },
      subtotal: item.quantity * item.price,
    })),
  };
}
