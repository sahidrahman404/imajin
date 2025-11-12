import type { EntityManager } from '@mikro-orm/core';
import { Cart } from './cart.entity.js';
import { CartItem } from './cart-item.entity.js';
import { Product } from '../product/product.entity.js';
import { User } from '../auth/user.entity.js';
import { CartNotFoundError, ItemNotFoundInTheCartError, ProductNotFoundError } from '../error.js';

export interface CartWithItems {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      name: string;
      price: number;
      description?: string;
    };
    subtotal: number;
  }>;
  total: number;
  itemCount: number;
}

export async function getOrCreateCart(user: User, em: EntityManager): Promise<Cart> {
  let cart = await em.findOne(Cart, { user: user });

  if (!cart) {
    cart = new Cart();
    cart.user = user;
    em.persist(cart);
    await em.flush();
  }

  return cart;
}

export async function addToCart(
  user: User,
  productId: number,
  quantity: number,
  em: EntityManager
): Promise<void> {
  const product = await em.findOne(Product, productId);
  if (!product) {
    throw new ProductNotFoundError();
  }

  const cart = await getOrCreateCart(user, em);

  const existingItem = await em.findOne(CartItem, {
    cart: cart.id,
    product: productId,
  });

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.updatedAt = new Date();
  } else {
    const cartItem = new CartItem();
    cartItem.cart = cart;
    cartItem.product = product;
    cartItem.quantity = quantity;
    em.persist(cartItem);
  }

  await em.flush();
}

export async function updateCartItem(
  user: User,
  productId: number,
  quantity: number,
  em: EntityManager
): Promise<void> {
  const cart = await em.findOne(Cart, { user: user });

  if (!cart) {
    throw new CartNotFoundError();
  }

  const cartItem = await em.findOne(CartItem, {
    cart: cart.id,
    product: productId,
  });

  if (!cartItem) {
    throw new ItemNotFoundInTheCartError();
  }

  cartItem.quantity = quantity;
  cartItem.updatedAt = new Date();
  await em.flush();
}

export async function removeFromCart(
  user: User,
  productId: number,
  em: EntityManager
): Promise<void> {
  const cart = await em.findOne(Cart, { user: user });
  if (!cart) {
    throw new CartNotFoundError();
  }

  const cartItem = await em.findOne(CartItem, {
    cart: cart.id,
    product: productId,
  });

  if (!cartItem) {
    throw new ItemNotFoundInTheCartError();
  }

  em.remove(cartItem);
  await em.flush();
}

export async function getCartWithItems(user: User, em: EntityManager): Promise<CartWithItems> {
  const cart = await em.findOne(
    Cart,
    { user: user },
    {
      populate: ['items', 'items.product'],
    }
  );

  if (!cart) {
    const newCart = await getOrCreateCart(user, em);
    return {
      id: newCart.id,
      createdAt: newCart.createdAt,
      updatedAt: newCart.updatedAt,
      items: [],
      total: 0,
      itemCount: 0,
    };
  }

  const items = cart.items.getItems().map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      description: item.product.description,
    },
    subtotal: item.quantity * item.product.price,
  }));

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.id,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items,
    total,
    itemCount,
  };
}

export async function clearCart(user: User, em: EntityManager): Promise<void> {
  const cart = await em.findOne(Cart, { user: user }, { populate: ['items'] });

  if (!cart) {
    return;
  }

  const cartItems = cart.items.getItems();
  cartItems.forEach((item) => em.remove(item));

  await em.flush();
}

export async function getCartItems(user: User, em: EntityManager): Promise<CartItem[]> {
  const cart = await em.findOne(Cart, { user: user }, { populate: ['items', 'items.product'] });

  if (!cart) {
    return [];
  }

  return cart.items.getItems();
}
