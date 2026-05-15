import type { ID, InviteCode, InviteStatus } from '@/types';

/**
 * Deterministic invite-code generator for /admin/convites.
 *
 * Models the viral loop the product wants:
 *   - The team mints N seed codes ("admin" source).
 *   - When a code is redeemed, 4 fresh codes are stamped under
 *     the new user ("user" source), each with parentCodeId set.
 *   - Those 4 codes get their own mix of statuses (pending, used,
 *     expired) so the table shows a realistic distribution.
 *
 * Determinism: every call from the page produces the same dataset
 * — important so the table doesn't shuffle between renders (the
 * Convites page is purely static today; the real backend that
 * lands later can swap this for an API call without touching the
 * page renderer).
 *
 * Approximate dataset:
 *   - 24 seed codes minted by the team
 *   - 16 of those are used (each branches 4)
 *   - 64 child codes (mix of pending / used / expired)
 *   - Total ≈ 88 rows
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skips I/O/0/1

const ADMINS = [
  { id: 'admin-1', name: 'Marcelo Demaribaxhix', email: 'marcelo@muusic.com.br' },
  { id: 'admin-2', name: 'Equipe Growth',         email: 'growth@muusic.com.br' },
  { id: 'admin-3', name: 'Lucas Almeida',         email: 'lucas@muusic.com.br' },
];

const USERS = [
  { id: 'u-001', name: 'Ana Souza',         email: 'ana@exemplo.com',     avatar: 'https://i.pravatar.cc/96?img=5' },
  { id: 'u-002', name: 'Bruno Oliveira',    email: 'bruno@exemplo.com',   avatar: 'https://i.pravatar.cc/96?img=12' },
  { id: 'u-003', name: 'Camila Ferreira',   email: 'camila@exemplo.com',  avatar: 'https://i.pravatar.cc/96?img=24' },
  { id: 'u-004', name: 'Diego Martins',     email: 'diego@exemplo.com',   avatar: 'https://i.pravatar.cc/96?img=33' },
  { id: 'u-005', name: 'Eduarda Lima',      email: 'eduarda@exemplo.com', avatar: 'https://i.pravatar.cc/96?img=44' },
  { id: 'u-006', name: 'Felipe Rocha',      email: 'felipe@exemplo.com',  avatar: 'https://i.pravatar.cc/96?img=51' },
  { id: 'u-007', name: 'Gabriela Castro',   email: 'gabriela@exemplo.com',avatar: 'https://i.pravatar.cc/96?img=23' },
  { id: 'u-008', name: 'Henrique Tavares',  email: 'henrique@exemplo.com',avatar: 'https://i.pravatar.cc/96?img=58' },
  { id: 'u-009', name: 'Isabela Moreira',   email: 'isabela@exemplo.com', avatar: 'https://i.pravatar.cc/96?img=36' },
  { id: 'u-010', name: 'Júlio Andrade',     email: 'julio@exemplo.com',   avatar: 'https://i.pravatar.cc/96?img=68' },
  { id: 'u-011', name: 'Larissa Santos',    email: 'larissa@exemplo.com', avatar: 'https://i.pravatar.cc/96?img=47' },
  { id: 'u-012', name: 'Marcos Silva',      email: 'marcos@exemplo.com',  avatar: 'https://i.pravatar.cc/96?img=15' },
  { id: 'u-013', name: 'Natália Pinto',     email: 'natalia@exemplo.com', avatar: 'https://i.pravatar.cc/96?img=19' },
  { id: 'u-014', name: 'Otávio Mendes',     email: 'otavio@exemplo.com',  avatar: 'https://i.pravatar.cc/96?img=64' },
  { id: 'u-015', name: 'Paula Cardoso',     email: 'paula@exemplo.com',   avatar: 'https://i.pravatar.cc/96?img=39' },
  { id: 'u-016', name: 'Rafael Nunes',      email: 'rafael@exemplo.com',  avatar: 'https://i.pravatar.cc/96?img=20' },
];

const NOTES = [
  'Beta wave 1', 'Beta wave 2', 'Influencer push BR',
  'Time interno', 'Closed beta · músicos', undefined, undefined, undefined,
];

/* ── LCG seeded by a constant so the dataset is stable ───────── */

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function pickFrom<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function generateCode(rnd: () => number): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  }
  return out;
}

/** UI helper: split "A8K2Z9" → "A8K-2Z9" for readability. Keeps the
 *  raw `code` field clean so copy-paste pastes 6 chars. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/* ── Public builder ──────────────────────────────────────────── */

export function buildMockInviteCodes(): InviteCode[] {
  const rnd = makeRng(20260515);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const rows: InviteCode[] = [];
  const seedCount = 24;

  // ── 1) Seed codes minted by the admin team ───────────────
  for (let i = 0; i < seedCount; i++) {
    const admin = pickFrom(rnd, ADMINS);
    const createdAt = new Date(now - (60 - rnd() * 50) * day).toISOString();
    // 16 of the 24 seeds end up being redeemed.
    const willBeUsed = i < 16;
    const note = pickFrom(rnd, NOTES);

    const id = `inv-seed-${i.toString(36).padStart(3, '0')}`;
    rows.push({
      id,
      code: generateCode(rnd),
      status: 'pending', // patched below when willBeUsed
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 60 * day).toISOString(),
      createdBy: { ...admin, source: 'admin' },
      usedAt: null,
      usedBy: null,
      childCodeIds: [],
      parentCodeId: null,
      note,
    });

    if (willBeUsed) {
      const redeemer = USERS[i % USERS.length];
      const usedAt = new Date(Date.parse(createdAt) + rnd() * 20 * day).toISOString();
      rows[i].status = 'used';
      rows[i].usedAt = usedAt;
      rows[i].usedBy = redeemer;
    }
  }

  // ── 2) For each redeemed seed, mint 4 child codes ────────
  for (const seed of rows.filter((r) => r.status === 'used')) {
    const redeemer = seed.usedBy!;
    const redeemedAt = Date.parse(seed.usedAt!);

    const childIds: ID[] = [];
    for (let i = 0; i < 4; i++) {
      const childId = `${seed.id}-c${i}`;
      childIds.push(childId);

      // child code creation timestamp = parent redemption + a few
      // minutes (system mints them immediately on redeem).
      const createdAt = new Date(redeemedAt + (i + 1) * 90 * 1000).toISOString();

      // Distribute statuses on the children:
      //   - 2/4 stay pending
      //   - 1/4 gets used
      //   - 1/4 expires (older trees mostly)
      let status: InviteStatus = 'pending';
      let usedAt: string | null = null;
      let usedBy: InviteCode['usedBy'] = null;
      if (i === 0) {
        status = 'used';
        const subUser = pickFrom(rnd, USERS);
        usedAt = new Date(redeemedAt + (1 + rnd() * 10) * day).toISOString();
        usedBy = subUser;
      } else if (i === 3 && rnd() < 0.55) {
        status = 'expired';
      }

      rows.push({
        id: childId,
        code: generateCode(rnd),
        status,
        createdAt,
        expiresAt: new Date(Date.parse(createdAt) + 60 * day).toISOString(),
        createdBy: {
          id: redeemer.id,
          name: redeemer.name,
          email: redeemer.email,
          avatar: redeemer.avatar,
          source: 'user',
        },
        usedAt,
        usedBy,
        childCodeIds: [],
        parentCodeId: seed.id,
      });
    }
    seed.childCodeIds = childIds;
  }

  // ── 3) Newest-first ──────────────────────────────────────
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ── Summary metrics ─────────────────────────────────────── */

export interface InviteSummary {
  total: number;
  pending: number;
  used: number;
  expired: number;
  revoked: number;
  /** used / total (excluding revoked/expired). */
  conversionRate: number;
  /** Mean depth of the viral tree (1 = redeemer only, 2 = friend
   *  of redeemer, etc.). */
  averageDepth: number;
  /** Distinct redeemers — proxy for new users acquired through the
   *  invite system. */
  uniqueRedeemers: number;
}

export function summarizeInvites(rows: InviteCode[]): InviteSummary {
  const counts: Record<InviteStatus, number> = {
    pending: 0,
    used:    0,
    expired: 0,
    revoked: 0,
  };
  const redeemers = new Set<ID>();
  let depthSum = 0;
  let depthCount = 0;

  // Build parent index for depth walk.
  const byId = new Map<ID, InviteCode>();
  for (const r of rows) byId.set(r.id, r);

  for (const r of rows) {
    counts[r.status]++;
    if (r.usedBy) redeemers.add(r.usedBy.id);
    if (r.status === 'used') {
      // Walk up parent chain to compute depth.
      let depth = 1;
      let cur: InviteCode | undefined = r;
      while (cur?.parentCodeId) {
        depth++;
        cur = byId.get(cur.parentCodeId);
      }
      depthSum += depth;
      depthCount++;
    }
  }

  const eligible = rows.length - counts.revoked;
  return {
    total: rows.length,
    pending: counts.pending,
    used:    counts.used,
    expired: counts.expired,
    revoked: counts.revoked,
    conversionRate: eligible > 0 ? counts.used / eligible : 0,
    averageDepth: depthCount > 0 ? depthSum / depthCount : 0,
    uniqueRedeemers: redeemers.size,
  };
}
