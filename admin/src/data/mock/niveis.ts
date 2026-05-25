/**
 * Mock data dos níveis de superfãs (Top 1 / 10 / 50 / 100).
 *
 * Por enquanto, tudo client-side. Cada tier tem benefícios
 * configuráveis + uma lista mocada de membros. Quando o BE cair,
 * vira:
 *   GET  /api/admin/niveis             → 4 tiers + counts
 *   GET  /api/admin/niveis/{tier}      → tier completo (benefícios + members)
 *   PUT  /api/admin/niveis/{tier}      → atualiza benefícios
 *
 * O conceito de "tier" é deterministicamente derivado do ranking
 * em fanpoints — o usuário não escolhe, o sistema atribui. A
 * página só edita os BENEFÍCIOS de cada tier (consequência do
 * ranking), não a regra de elegibilidade.
 */

export type NivelTier = 'top1' | 'top10' | 'top50' | 'top100';

export interface NivelBenefit {
  id: string;
  title: string;
  description: string;
  /** Categoria visual — afeta o ícone/badge no card. */
  kind: 'access' | 'item' | 'event' | 'discount' | 'recognition';
  enabled: boolean;
}

export interface NivelMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** Posição atual no ranking (1, 2, 3...). */
  rank: number;
  /** Total de fanpoints acumulados. */
  fanpoints: number;
  /** Quanto tempo o user está nesse tier. */
  inTierSince: string; // ISO date
  /** Cidade-UF abreviado pra exibir compacto. */
  location: string;
}

export interface NivelTierData {
  tier: NivelTier;
  /** Label visível ("Top 1", "Top 10", etc). */
  label: string;
  /** Slots no tier — 1, 10, 50 ou 100. */
  capacity: number;
  /** Cor temática usada nos cards/badges (hex sem alpha). */
  color: string;
  /** Frase curta vendendo o tier (aparece na hub + topo do detail). */
  tagline: string;
  benefits: NivelBenefit[];
  members: NivelMember[];
}

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

/* Pool de nomes/avatares mocado — reusado entre os tiers com
 * variações de rank + fanpoints. Não cresce até 100 membros nos
 * dados (overhead enorme); o Top 100 vai ter só 25 entries pra
 * demonstrar e a UI mostra "+75 outros" no final da lista. */
const POOL: Omit<NivelMember, 'rank' | 'fanpoints' | 'inTierSince'>[] = [
  { id: 'fan_001', name: 'Helena Drummond',  email: 'helena@email.com',   location: 'SP-SP', avatar: 'https://i.pravatar.cc/120?img=42' },
  { id: 'fan_002', name: 'Vinícius Marques', email: 'vinicius@email.com', location: 'RJ-RJ', avatar: 'https://i.pravatar.cc/120?img=14' },
  { id: 'fan_003', name: 'Patrícia Rocha',   email: 'patricia@email.com', location: 'BH-MG', avatar: 'https://i.pravatar.cc/120?img=39' },
  { id: 'fan_004', name: 'Bruno Tavares',    email: 'bruno@email.com',    location: 'POA-RS', avatar: 'https://i.pravatar.cc/120?img=21' },
  { id: 'fan_005', name: 'Sofia Andrade',    email: 'sofia@email.com',    location: 'CWB-PR', avatar: 'https://i.pravatar.cc/120?img=36' },
  { id: 'fan_006', name: 'Paulo Henrique',   email: 'paulo@email.com',    location: 'REC-PE', avatar: 'https://i.pravatar.cc/120?img=11' },
  { id: 'fan_007', name: 'Camila Borges',    email: 'camila@email.com',   location: 'SSA-BA', avatar: 'https://i.pravatar.cc/120?img=47' },
  { id: 'fan_008', name: 'Diego Castro',     email: 'diego@email.com',    location: 'FOR-CE', avatar: 'https://i.pravatar.cc/120?img=18' },
  { id: 'fan_009', name: 'Renata Lopes',     email: 'renata@email.com',   location: 'BSB-DF', avatar: 'https://i.pravatar.cc/120?img=49' },
  { id: 'fan_010', name: 'Eduardo Lima',     email: 'eduardo@email.com',  location: 'MAO-AM', avatar: 'https://i.pravatar.cc/120?img=33' },
  { id: 'fan_011', name: 'Larissa Pinto',    email: 'larissa@email.com',  location: 'GYN-GO', avatar: 'https://i.pravatar.cc/120?img=44' },
  { id: 'fan_012', name: 'Marcos Vieira',    email: 'marcos@email.com',   location: 'VIX-ES', avatar: 'https://i.pravatar.cc/120?img=22' },
  { id: 'fan_013', name: 'Júlia Fernandes',  email: 'julia@email.com',    location: 'FLN-SC', avatar: 'https://i.pravatar.cc/120?img=46' },
  { id: 'fan_014', name: 'Rafael Almeida',   email: 'rafael@email.com',   location: 'NAT-RN', avatar: 'https://i.pravatar.cc/120?img=12' },
  { id: 'fan_015', name: 'Beatriz Souza',    email: 'beatriz@email.com',  location: 'BEL-PA', avatar: 'https://i.pravatar.cc/120?img=41' },
  { id: 'fan_016', name: 'Lucas Pereira',    email: 'lucas@email.com',    location: 'CGB-MT', avatar: 'https://i.pravatar.cc/120?img=15' },
  { id: 'fan_017', name: 'Mariana Costa',    email: 'mariana@email.com',  location: 'TER-PI', avatar: 'https://i.pravatar.cc/120?img=45' },
  { id: 'fan_018', name: 'André Silva',      email: 'andre@email.com',    location: 'CGR-MS', avatar: 'https://i.pravatar.cc/120?img=17' },
  { id: 'fan_019', name: 'Thais Oliveira',   email: 'thais@email.com',    location: 'SLZ-MA', avatar: 'https://i.pravatar.cc/120?img=43' },
  { id: 'fan_020', name: 'Felipe Ramos',     email: 'felipe@email.com',   location: 'PMW-TO', avatar: 'https://i.pravatar.cc/120?img=19' },
  { id: 'fan_021', name: 'Aline Martins',    email: 'aline@email.com',    location: 'RIO-AC', avatar: 'https://i.pravatar.cc/120?img=48' },
  { id: 'fan_022', name: 'Tiago Barros',     email: 'tiago@email.com',    location: 'PVH-RO', avatar: 'https://i.pravatar.cc/120?img=13' },
  { id: 'fan_023', name: 'Carolina Dias',    email: 'carolina@email.com', location: 'BVB-RR', avatar: 'https://i.pravatar.cc/120?img=40' },
  { id: 'fan_024', name: 'Gabriel Moreira',  email: 'gabriel@email.com',  location: 'MCZ-AL', avatar: 'https://i.pravatar.cc/120?img=16' },
  { id: 'fan_025', name: 'Isabela Cardoso',  email: 'isabela@email.com',  location: 'JPA-PB', avatar: 'https://i.pravatar.cc/120?img=38' },
];

/* Distribuição dos members por tier — cada tier herda os ranks
 * apropriados. Top1 = só rank 1; Top10 = ranks 1..10; etc.
 * Fanpoints decrescem em curva pra que rank 1 esteja MUITO acima
 * dos demais (típico do real). */
function buildMembers(maxRank: number, daysSinceMax: number): NivelMember[] {
  const usable = POOL.slice(0, Math.min(maxRank, POOL.length));
  return usable.map((m, i) => ({
    ...m,
    rank: i + 1,
    /* Curva: rank 1 = ~18.000 fp, rank 100 = ~600 fp. */
    fanpoints: Math.round(18_000 * Math.exp(-i * 0.04)),
    /* Membros antigos no rank top → 30 days, recentes no rank 25
     * → 2 days. Linear. */
    inTierSince: days(Math.max(2, daysSinceMax - i)),
  }));
}

/** Source-of-truth dos 4 tiers + estado inicial dos benefícios.
 *  O page de detalhe vai poder editar (CRUD client-side em
 *  memória — quando o BE cair, hidrata-se daqui). */
export const NIVEIS_DATA: NivelTierData[] = [
  {
    tier: 'top1',
    label: 'Top 1',
    capacity: 1,
    color: '#f5b400', // gold
    tagline: 'O fã número 1. Acesso vitalício e privilégios únicos.',
    benefits: [
      {
        id: 'b_top1_001',
        title: 'Encontro privado anual com a artista',
        description: 'Meet & greet exclusivo de 30 minutos uma vez por ano.',
        kind: 'event',
        enabled: true,
      },
      {
        id: 'b_top1_002',
        title: 'Cadeira reservada em todos os shows',
        description: 'Lugar marcado na frente em qualquer show oficial — sem custo.',
        kind: 'access',
        enabled: true,
      },
      {
        id: 'b_top1_003',
        title: 'Disco autografado',
        description: 'Recebe vinil físico exclusivo do próximo lançamento, autografado.',
        kind: 'item',
        enabled: true,
      },
      {
        id: 'b_top1_004',
        title: 'Crédito nominal no álbum',
        description: 'Nome aparece nos agradecimentos do próximo álbum/EP lançado.',
        kind: 'recognition',
        enabled: true,
      },
      {
        id: 'b_top1_005',
        title: 'Acesso antecipado a todo lançamento',
        description: 'Recebe single/álbum 48h antes do lançamento público.',
        kind: 'access',
        enabled: true,
      },
    ],
    members: buildMembers(1, 30),
  },
  {
    tier: 'top10',
    label: 'Top 10',
    capacity: 10,
    color: '#a855f7', // purple
    tagline: 'O círculo mais próximo. Bastidores e drops exclusivos.',
    benefits: [
      {
        id: 'b_top10_001',
        title: 'Acesso ao backstage',
        description: 'Pass de bastidor em 1 show por turnê.',
        kind: 'access',
        enabled: true,
      },
      {
        id: 'b_top10_002',
        title: 'Drops mensais exclusivos',
        description: 'Camisetas, posters e materiais lançados só pra Top 10.',
        kind: 'item',
        enabled: true,
      },
      {
        id: 'b_top10_003',
        title: 'Live privada trimestral',
        description: 'Chamada de vídeo em grupo com a artista a cada 3 meses.',
        kind: 'event',
        enabled: true,
      },
      {
        id: 'b_top10_004',
        title: 'Pre-save em todos os singles',
        description: 'Notificação 7 dias antes pra garantir pre-save em primeira mão.',
        kind: 'access',
        enabled: true,
      },
      {
        id: 'b_top10_005',
        title: 'Desconto de 50% no merch',
        description: 'Cupom permanente de 50% off em toda a loja oficial.',
        kind: 'discount',
        enabled: false,
      },
    ],
    members: buildMembers(10, 28),
  },
  {
    tier: 'top50',
    label: 'Top 50',
    capacity: 50,
    color: '#3b82f6', // blue
    tagline: 'Engajados de verdade. Conteúdo extra e descontos.',
    benefits: [
      {
        id: 'b_top50_001',
        title: 'Acesso à comunidade exclusiva',
        description: 'Canal privado no Discord/Telegram com a galera Top 50.',
        kind: 'access',
        enabled: true,
      },
      {
        id: 'b_top50_002',
        title: 'Bastidor em vídeo',
        description: 'Vlogs de bastidores entregues mensalmente nessa lista.',
        kind: 'item',
        enabled: true,
      },
      {
        id: 'b_top50_003',
        title: 'Desconto de 25% no merch',
        description: 'Cupom permanente de 25% off na loja oficial.',
        kind: 'discount',
        enabled: true,
      },
      {
        id: 'b_top50_004',
        title: 'Voto em decisões da artista',
        description: 'Polls exclusivas (capa de single, próximo cover, set de show).',
        kind: 'recognition',
        enabled: false,
      },
    ],
    members: buildMembers(25, 25),
  },
  {
    tier: 'top100',
    label: 'Top 100',
    capacity: 100,
    color: '#10b981', // green
    tagline: 'Os mais ativos. Reconhecimento e benefícios de entrada.',
    benefits: [
      {
        id: 'b_top100_001',
        title: 'Selo "Top 100" no perfil',
        description: 'Badge visível no perfil pra outros fãs reconhecerem.',
        kind: 'recognition',
        enabled: true,
      },
      {
        id: 'b_top100_002',
        title: 'Newsletter exclusiva',
        description: 'Conteúdo semanal direto da artista, antes de qualquer outro canal.',
        kind: 'item',
        enabled: true,
      },
      {
        id: 'b_top100_003',
        title: 'Desconto de 10% no merch',
        description: 'Cupom permanente de 10% off na loja oficial.',
        kind: 'discount',
        enabled: true,
      },
    ],
    members: buildMembers(25, 20),
  },
];

export const KIND_LABEL: Record<NivelBenefit['kind'], string> = {
  access:      'Acesso',
  item:        'Item físico/digital',
  event:       'Evento',
  discount:    'Desconto',
  recognition: 'Reconhecimento',
};
