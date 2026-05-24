/**
 * Pre-Save — service de campanhas de pre-save.
 *
 * Padrão equivalente ao `liveService` / `superchatService`.
 */

import { loadPreSaveCampaigns } from '@/data/mock/preSave';

export type {
  PreSaveCampaign,
  PreSaveStatus,
} from '@/data/mock/preSave';

export {
  PLATFORM_LABEL as PRE_SAVE_PLATFORM_LABEL,
  STATUS_LABEL as PRE_SAVE_STATUS_LABEL,
} from '@/data/mock/preSave';

export const preSaveService = {
  list: async () => loadPreSaveCampaigns(),
};
