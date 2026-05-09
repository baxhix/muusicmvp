import { z } from 'zod';

const schema = z.object({
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  MAPBOX_TOKEN: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = schema.parse({
  APP_URL: process.env.APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
});
