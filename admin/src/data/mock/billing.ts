import type { BillingInvoice, BillingPlan, WorkspaceSettings } from '@/types';

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

export const MOCK_BILLING_PLAN: BillingPlan = {
  id: 'growth',
  name: 'Growth',
  monthlyBRL: 1490,
  seats: 10,
  seatsUsed: 6,
  nextChargeAt: days(-12), // 12 days from now
  paymentMethod: {
    brand: 'Visa',
    last4: '4242',
    expiresAt: '08/2028',
  },
};

export const MOCK_INVOICES: BillingInvoice[] = [
  { id: 'inv_001', number: 'FV-2026-0432', date: days(2),  amount: 1490, status: 'paid' },
  { id: 'inv_002', number: 'FV-2026-0398', date: days(33), amount: 1490, status: 'paid' },
  { id: 'inv_003', number: 'FV-2026-0361', date: days(63), amount: 1490, status: 'paid' },
  { id: 'inv_004', number: 'FV-2026-0327', date: days(94), amount: 1490, status: 'paid' },
  { id: 'inv_005', number: 'FV-2026-0294', date: days(124), amount: 1190, status: 'paid' },
  { id: 'inv_006', number: 'FV-2026-0263', date: days(155), amount: 1190, status: 'paid' },
];

export const MOCK_WORKSPACE: WorkspaceSettings = {
  name: 'Fanverse',
  slug: 'fanverse',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  description: 'Plataforma social para superfãs de música no Brasil.',
};
