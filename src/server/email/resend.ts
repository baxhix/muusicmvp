import { Resend } from 'resend';
import { env } from '../env';

let client: Resend | undefined;

/**
 * Lazy Resend client — instantiated on first call so module-load doesn't
 * trigger env validation (which fails during Next's build-time page-data
 * collection where runtime envs aren't set).
 */
export function getResend(): Resend {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}
