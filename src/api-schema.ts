import { z } from 'zod';

export const badRequestResponseSchema = z.object({
  error: z.array(
    z.object({
      path: z.array(z.string()),
      message: z.string(),
    })
  ),
  success: z.boolean().default(false),
});

export const appErrorResponseSchema = z.object({
  success: z.boolean().default(false),
  message: z.string(),
});
