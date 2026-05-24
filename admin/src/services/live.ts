/**
 * Live — service de eventos ao vivo.
 *
 * Hoje: re-exporta o loader síncrono de `@/data/mock/live`.
 * Amanhã: substitui `liveService.list` por um GET HTTP — o
 * shape do retorno (LiveEvent[]) já está estável, então pages
 * que consomem este service não vão precisar mudar.
 *
 * Convenção do admin: pages NUNCA importam de `@/data/mock/*`
 * direto. Sempre passam por um service — facilita migração e
 * mantém o domain layer separado.
 */

import { loadLiveEvents } from '@/data/mock/live';

export type {
  LiveEvent,
  LiveStatus,
} from '@/data/mock/live';

export {
  STATUS_LABEL as LIVE_STATUS_LABEL,
  AUDIENCE_LABEL as LIVE_AUDIENCE_LABEL,
} from '@/data/mock/live';

export const liveService = {
  /** Lista todos os eventos. Async pra alinhar com o futuro fetch. */
  list: async () => loadLiveEvents(),
};
