import { z } from 'zod';

export const orderStatusSchema = z.enum(['pending', 'processing', 'completed', 'cancelled']);

export const successOrderSchema = z.object({
  success: z.boolean(),
  data: z.object({
    order: z.object({
      id: z.number(),
      total: z.number(),
      status: orderStatusSchema,
      createdAt: z.number(),
      updatedAt: z.number(),
      items: z.array(
        z.object({
          id: z.number(),
          quantity: z.number(),
          price: z.number(),
          product: z.object({
            id: z.number(),
            name: z.string(),
            description: z.string(),
          }),
          subtotal: z.number(),
        })
      ),
    }),
  }),
});
