import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  statusCode: ContentfulStatusCode;

  constructor(message: string, statusCode: ContentfulStatusCode, name?: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = name ?? 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EmailConflictError extends AppError {
  constructor() {
    super(
      'A user with this email address already exists. Please use a different email.',
      409,
      'EmailConflictError'
    );
  }
}

export class InvalidCredentialError extends AppError {
  constructor() {
    super('Incorrect email or password', 401, 'InvalidCredentialError');
  }
}

export class InvalidSessionError extends AppError {
  constructor() {
    super('Invalid session. Please sign in again.', 401, 'InvalidSessionError');
  }
}

export class ExpiredSessionError extends AppError {
  constructor() {
    super('Session has expired. Please sign in again.', 401, 'ExpiredSessionError');
  }
}

export class CartNotFoundError extends AppError {
  constructor() {
    super('Cart not found', 404, 'CartNotFoundError');
  }
}

export class ItemNotFoundInTheCartError extends AppError {
  constructor() {
    super('Item not found in the cart', 404, 'ItemNotFoundInTheCartError');
  }
}

export class CartIsEmptyError extends AppError {
  constructor() {
    super('Cart is empty', 400, 'CartIsEmptyError');
  }
}

export class OrderNotFoundError extends AppError {
  constructor() {
    super('Order not found', 400, 'OrderNotFoundError');
  }
}

export class ProductNotFoundError extends AppError {
  constructor() {
    super('Product not found', 400, 'ProductNotFoundError');
  }
}

export class NoValidItemsSelectedError extends AppError {
  constructor() {
    super('No valid items selected', 400, 'NoValidItemSelectedError');
  }
}
