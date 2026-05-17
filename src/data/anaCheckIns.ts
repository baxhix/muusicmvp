/**
 * Ana Castela check-in simulation presets.
 *
 * Each entry is one of the cities Ana actually shows up in — her
 * birthplace (Sete Quedas-MS), the Paraná hub (Londrina, where she
 * grew up), São Paulo (recurring shows), and a few national stops.
 * The scheduler picks the next slot from `ANA_CHECKINS` in order
 * (round-robin) every 2 minutes; the modal renders whatever
 * `media` is in the picked slot.
 *
 * Production note: when we wire this to a real CMS, swap the
 * scheduler import for a fetch to /api/feed/ana-checkin?active=true
 * — the wire shape `AnaCheckInPayload` is intentionally the same so
 * the swap is one-line.
 */

import type { AnaCheckInPayload } from '@/lib/globeStore';

/** A check-in template (no id / startedAt yet — those are stamped at spawn). */
export interface AnaCheckInTemplate {
  city: string;
  state: string;
  lng: number;
  lat: number;
  caption?: string;
  media: AnaCheckInPayload['media'];
}

export const ANA_CHECKINS: AnaCheckInTemplate[] = [
  {
    city: 'Sete Quedas',
    state: 'MS',
    // Ana Castela's hometown — Sete Quedas, Mato Grosso do Sul.
    lng: -55.5232,
    lat: -23.9728,
    caption:
      'Voltei pra casa! Passeio rápido pelas terras que me viram crescer 🐎',
    media: [
      { type: 'image', url: '/feed/ana-castela-1.png', alt: 'Ana em Sete Quedas-MS' },
      { type: 'image', url: '/feed/ana-castela-2.png', alt: 'Ana em Sete Quedas-MS' },
    ],
  },
  {
    city: 'Londrina',
    state: 'PR',
    lng: -51.1628,
    lat: -23.3105,
    caption: 'Londrina hoje à noite! Quem vai estar lá? 🤠',
    media: [
      { type: 'image', url: '/feed/ana-castela-fespop-1.png', alt: 'Show em Londrina' },
      { type: 'image', url: '/feed/ana-castela-fespop-2.png', alt: 'Show em Londrina' },
      { type: 'image', url: '/feed/ana-castela-fespop-3.png', alt: 'Show em Londrina' },
    ],
  },
  {
    city: 'São Paulo',
    state: 'SP',
    lng: -46.6396,
    lat: -23.5475,
    caption: 'Sampa, cheguei! Bora fazer barulho 🔥',
    media: [
      { type: 'image', url: '/feed/ana-castela-fespop-4.png', alt: 'Ana em São Paulo' },
      { type: 'image', url: '/feed/ana-castela-3.png', alt: 'Ana em São Paulo' },
    ],
  },
  {
    city: 'Curitiba',
    state: 'PR',
    lng: -49.2733,
    lat: -25.4284,
    caption: 'Bom dia, Cuririba! Aqui faz frio mas o coração tá quente 💚',
    media: [
      { type: 'image', url: '/feed/ana-castela-4.png', alt: 'Ana em Curitiba' },
    ],
  },
  {
    city: 'Goiânia',
    state: 'GO',
    lng: -49.2536,
    lat: -16.6864,
    caption: 'Goiânia, tô voltando pra cantar com vocês! 🎤',
    media: [
      { type: 'image', url: '/feed/ana-castela-1.png', alt: 'Ana em Goiânia' },
      { type: 'image', url: '/feed/ana-castela-2.png', alt: 'Ana em Goiânia' },
    ],
  },
  {
    city: 'Belo Horizonte',
    state: 'MG',
    lng: -43.9352,
    lat: -19.9167,
    caption: 'BH, tava com saudade! Hoje tem festa 🌟',
    media: [
      { type: 'image', url: '/feed/ana-castela-3.png', alt: 'Ana em BH' },
    ],
  },
];
