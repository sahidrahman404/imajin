import { z } from 'zod';

export const successCartResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    cart: z.object({
      id: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
      items: z.array(
        z.object({
          id: z.number(),
          quantity: z.number(),
          product: z.object({
            id: z.number(),
            name: z.string(),
            price: z.number(),
            description: z.string(),
          }),
          subtotal: z.number(),
        })
      ),
      total: z.number(),
      itemCount: z.number(),
    }),
  }),
});
