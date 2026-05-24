/**
 * Superchat — service de salas de chat coletivo.
 *
 * Padrão equivalente ao `liveService` / `preSaveService`: hoje
 * encapsula o loader mock; amanhã passa pra HTTP sem mudar pages.
 */

import { loadSuperchatRooms } from '@/data/mock/superchat';

export type {
  SuperchatRoom,
  SuperchatRoomStatus,
} from '@/data/mock/superchat';

export {
  SUPERCHAT_STATUS_LABEL,
  SUPERCHAT_KIND_LABEL,
} from '@/data/mock/superchat';

export const superchatService = {
  list: async () => loadSuperchatRooms(),
};
