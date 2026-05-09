import { z } from 'zod';

const schema = z.object({
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  MAPBOX_TOKEN: z.string().min(1),
  // Optional: when set, the session cookie is scoped to this domain so it's
  // shared between muusic.live and admin.muusic.live. Use leading dot:
  // ".muusic.live"
  COOKIE_DOMAIN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

type Env = z.infer<typeof schema>;

let cached: Env | undefined;

function load(): Env {
  if (cached) return cached;
  cached = schema.parse({
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
    NODE_ENV: process.env.NODE_ENV,
  });
  return cached;
}

/**
 * Lazy-validated env. Reads `process.env` on first property access, not at
 * module import — so Next.js's build-time "collecting page data" pass can
 * import server modules without runtime envs being set yet.
 */
export const env = new Proxy({} as Env, {
  get(_t, prop: string | symbol) {
    return load()[prop as keyof Env];
  },
}) as Env;
