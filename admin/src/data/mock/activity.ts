import type { ActivityEntry } from '@/types';

const NOW = Date.now();
const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString();
const hours = (n: number) => new Date(NOW - n * 3_600_000).toISOString();

export const MOCK_ACTIVITY: ActivityEntry[] = [
  {
    id: 'act_001',
    type: 'user.signup',
    actor: { id: 'u_016', name: 'Carolina Pires', avatar: 'https://i.pravatar.cc/64?img=45' },
    subject: 'cadastrou-se como fã',
    meta: 'Natal · RN',
    createdAt: minutes(2),
  },
  {
    id: 'act_002',
    type: 'report.opened',
    actor: { id: 'u_001', name: 'Ana Beatriz Mendes', avatar: 'https://i.pravatar.cc/64?img=47' },
    subject: 'denunciou um post de Felipe Andrade',
    meta: 'Motivo: discurso de ódio',
    createdAt: minutes(7),
  },
  {
    id: 'act_003',
    type: 'post.published',
    actor: { id: 'u_004', name: 'Camila Tanaka', avatar: 'https://i.pravatar.cc/64?img=24' },
    subject: 'publicou novo áudio',
    meta: '"Boiadeira (cover acústico)"',
    createdAt: minutes(28),
  },
  {
    id: 'act_004',
    type: 'user.suspended',
    actor: null,
    subject: 'Felipe Andrade foi suspenso',
    meta: 'Decisão automática · 7 reports em 24h',
    createdAt: minutes(45),
  },
  {
    id: 'act_005',
    type: 'report.resolved',
    actor: { id: 'admin_1', name: 'Marcelo Baxhix' },
    subject: 'resolveu denúncia #r_003',
    meta: 'Usuário banido permanentemente',
    createdAt: hours(2),
  },
  {
    id: 'act_006',
    type: 'payout.completed',
    actor: null,
    subject: 'Repasse semanal processado',
    meta: 'R$ 184.320,00 · 47 criadores',
    createdAt: hours(5),
  },
  {
    id: 'act_007',
    type: 'post.removed',
    actor: { id: 'admin_1', name: 'Marcelo Baxhix' },
    subject: 'removeu post #p_008',
    meta: 'Violação de regra: discurso de ódio',
    createdAt: hours(8),
  },
  {
    id: 'act_008',
    type: 'user.signup',
    actor: { id: 'u_009', name: 'Pedro Henrique Silva', avatar: 'https://i.pravatar.cc/64?img=33' },
    subject: 'cadastrou-se como criador',
    meta: 'Manaus · AM · Aguardando aprovação',
    createdAt: hours(11),
  },
  {
    id: 'act_009',
    type: 'user.banned',
    actor: { id: 'admin_1', name: 'Marcelo Baxhix' },
    subject: 'baniu Lucas Vieira (@lukvi)',
    meta: 'Motivo: assédio reincidente',
    createdAt: hours(14),
  },
  {
    id: 'act_010',
    type: 'post.published',
    actor: { id: 'u_014', name: 'Júlia Almeida', avatar: 'https://i.pravatar.cc/64?img=29' },
    subject: 'publicou novo vídeo',
    meta: '"Bastidores do clipe novo"',
    createdAt: hours(16),
  },
  {
    id: 'act_011',
    type: 'report.opened',
    actor: { id: 'u_013', name: 'Gabriel Nascimento', avatar: 'https://i.pravatar.cc/64?img=11' },
    subject: 'denunciou usuário @felandr',
    meta: 'Motivo: assédio',
    createdAt: hours(20),
  },
  {
    id: 'act_012',
    type: 'post.published',
    actor: { id: 'u_011', name: 'Matheus Oliveira', avatar: 'https://i.pravatar.cc/64?img=7' },
    subject: 'publicou nova playlist',
    meta: '"Playlist da semana — Forró 2026"',
    createdAt: hours(28),
  },
];
