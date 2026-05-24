/**
 * User activities — service de eventos de atividade dos usuários.
 *
 * Hoje: re-exporta os geradores síncronos de
 * `data/mock/userActivities` (criam um feed determinístico a
 * partir do user id pra mockar histórico). Convive com
 * `usersService.activities()` que já bate na API real — esses
 * helpers ficam sobre os dados live pra recalcular buckets.
 */

import {
  generateUserActivities as generateUserActivitiesMock,
  summarizeActivities as summarizeActivitiesMock,
} from '@/data/mock/userActivities';

export const generateUserActivities = generateUserActivitiesMock;
export const summarizeActivities = summarizeActivitiesMock;
