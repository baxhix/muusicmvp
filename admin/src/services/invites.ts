/**
 * Convites — service de invite codes.
 *
 * Wrapper sobre as fixtures + helpers de `data/mock/invites`.
 * Quando o backend de convites cair, `invitesService.list` vira
 * GET HTTP — `formatInviteCode` e `summarizeInvites` continuam
 * puramente client-side (formatadores de display).
 */

import {
  buildMockInviteCodes,
  summarizeInvites as summarizeInvitesMock,
  formatInviteCode as formatInviteCodeMock,
} from '@/data/mock/invites';

export const invitesService = {
  list: async () => buildMockInviteCodes(),
};

/** Formata "ABC123" → "ABC-123" pra display. */
export const formatInviteCode = formatInviteCodeMock;

/** Agrega KPIs sobre a lista de invites pro header da página. */
export const summarizeInvites = summarizeInvitesMock;
