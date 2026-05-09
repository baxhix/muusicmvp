import type { Stream, User, UserPlan, UserRole, UserSex, UserStatus } from '@/types';

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString();

/* ============================================================
   Pools — used by the generator below to invent extra users.
   ============================================================ */

const FIRST_NAMES_F = [
  'Ana', 'Mariana', 'Camila', 'Beatriz', 'Rafaela', 'Júlia', 'Letícia', 'Carolina',
  'Isabela', 'Larissa', 'Bruna', 'Daniela', 'Gabriela', 'Patrícia', 'Renata',
  'Marina', 'Helena', 'Sofia', 'Clara', 'Yasmin', 'Vitória', 'Sabrina', 'Aline',
  'Tatiane', 'Fernanda', 'Priscila',
];
const FIRST_NAMES_M = [
  'Pedro', 'João', 'Lucas', 'Felipe', 'Gabriel', 'Matheus', 'Thiago', 'Rafael',
  'Bruno', 'Diego', 'Rodrigo', 'Henrique', 'Vinícius', 'Eduardo', 'Marcelo',
  'André', 'Davi', 'Caio', 'Igor', 'Murilo', 'Otávio', 'Renan', 'Samuel',
  'Leonardo', 'Guilherme', 'Arthur',
];
const FIRST_NAMES_NB = ['Alex', 'Sam', 'Ariel', 'Max', 'Robin', 'Iuri', 'Cris'];

const SURNAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira',
  'Rodrigues', 'Almeida', 'Carvalho', 'Gomes', 'Ribeiro', 'Martins', 'Araújo',
  'Barbosa', 'Nascimento', 'Cardoso', 'Mendes', 'Tanaka', 'Pires', 'Vieira',
  'Tavares', 'Barros', 'Cordeiro', 'Andrade', 'Rocha', 'Gonçalves', 'Ramos',
];

const CITIES: { city: string; uf: string }[] = [
  { city: 'São Paulo', uf: 'SP' },
  { city: 'Rio de Janeiro', uf: 'RJ' },
  { city: 'Belo Horizonte', uf: 'MG' },
  { city: 'Curitiba', uf: 'PR' },
  { city: 'Porto Alegre', uf: 'RS' },
  { city: 'Salvador', uf: 'BA' },
  { city: 'Recife', uf: 'PE' },
  { city: 'Fortaleza', uf: 'CE' },
  { city: 'Brasília', uf: 'DF' },
  { city: 'Florianópolis', uf: 'SC' },
  { city: 'Goiânia', uf: 'GO' },
  { city: 'Manaus', uf: 'AM' },
  { city: 'Belém', uf: 'PA' },
  { city: 'Vitória', uf: 'ES' },
  { city: 'Campinas', uf: 'SP' },
  { city: 'Natal', uf: 'RN' },
  { city: 'João Pessoa', uf: 'PB' },
  { city: 'São Luís', uf: 'MA' },
  { city: 'Maceió', uf: 'AL' },
  { city: 'Aracaju', uf: 'SE' },
  { city: 'Cuiabá', uf: 'MT' },
  { city: 'Campo Grande', uf: 'MS' },
];

const SONGS: { title: string; artist: string }[] = [
  { title: 'Último Refrão',     artist: 'Forró do Alagoano' },
  { title: 'Luzes da Cidade',   artist: 'Camila Tanaka' },
  { title: 'Horizonte Azul',    artist: 'Júlia Almeida' },
  { title: 'Faixa Secreta',     artist: 'Júlia Almeida' },
  { title: 'Replay de Verão',   artist: 'Coletivo Norte' },
  { title: 'Acústico no Escuro', artist: 'Camila Tanaka' },
  { title: 'Cidade Distante',   artist: 'Mariana Lopes' },
  { title: 'Boiadeira',         artist: 'Ana Castela' },
  { title: 'Relógio Parado',    artist: 'Júlia Almeida' },
  { title: 'Caminho de Volta',  artist: 'Coletivo Norte' },
  { title: 'Vento Sul',         artist: 'Camila Tanaka' },
  { title: 'Quinta-feira',      artist: 'Forró do Alagoano' },
  { title: 'Madrugada Pop',     artist: 'Júlia Almeida' },
  { title: 'Carrossel',         artist: 'Camila Tanaka' },
  { title: 'Moletom Cinza',     artist: 'Coletivo Norte' },
];

/* ============================================================
   Deterministic PRNG (mulberry32) — keeps mock output stable
   between renders and across reloads.
   ============================================================ */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const r = rng(424242);
const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
const pickWeighted = <T,>(weighted: Array<[T, number]>): T => {
  const total = weighted.reduce((a, [, w]) => a + w, 0);
  let pickPoint = r() * total;
  for (const [v, w] of weighted) {
    pickPoint -= w;
    if (pickPoint <= 0) return v;
  }
  return weighted[weighted.length - 1][0];
};

function makePhone(): string {
  const ddd = ['11', '21', '31', '41', '51', '61', '71', '81', '85', '47', '48'];
  const a = String(Math.floor(r() * 9000) + 90000);
  const b = String(Math.floor(r() * 9000) + 1000);
  return `(${pick(ddd)}) ${a}-${b}`;
}

function ageOffsetDays(age: number): number {
  return age * 365 + Math.floor(r() * 365);
}

function makeStream(daysAgo: number): Stream {
  const song = pick(SONGS);
  const minutesAgo = daysAgo * 1440 + Math.floor(r() * 1440);
  return {
    title: song.title,
    artist: song.artist,
    playedAt: minutes(minutesAgo),
  };
}

function makeStreamHistory(count: number): Stream[] {
  const out: Stream[] = [];
  let cursorDays = 0;
  for (let i = 0; i < count; i++) {
    cursorDays += r() * 1.5;
    out.push(makeStream(cursorDays));
  }
  return out;
}

/* ============================================================
   Hand-crafted 16 users (story personas). Re-used by other
   pages (Dashboard activity, Superfans ranking, etc.).
   ============================================================ */

const FIXTURES: User[] = (
  [
    {
      base: {
        id: 'u_001',
        name: 'Ana Beatriz Mendes',
        handle: 'anabia',
        email: 'ana.beatriz@example.com',
        avatar: 'https://i.pravatar.cc/120?img=47',
        role: 'fan' as UserRole,
        status: 'active' as UserStatus,
        plan: 'superfan' as UserPlan,
        age: 27,
        sex: 'F' as UserSex,
        city: 'São Paulo',
        state: 'SP',
        fanpoints: 14832, level: 7, totalSpentBRL: 1284.5,
        followers: 412, following: 287, posts: 64,
        createdAt: days(412), lastActiveAt: minutes(3),
        isOnline: true, verified: true,
        totalStreams: 9810,
      },
    },
    {
      base: {
        id: 'u_002', name: 'Mariana Lopes', handle: 'marilop',
        email: 'mariana.lopes@example.com',
        avatar: 'https://i.pravatar.cc/120?img=32',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'plus' as UserPlan,
        age: 24, sex: 'F' as UserSex,
        city: 'Rio de Janeiro', state: 'RJ',
        fanpoints: 9210, level: 5, totalSpentBRL: 540,
        followers: 188, following: 421, posts: 23,
        createdAt: days(298), lastActiveAt: minutes(15),
        isOnline: true,
        totalStreams: 6420,
      },
    },
    {
      base: {
        id: 'u_003', name: 'João Pedro Carvalho', handle: 'jpcarv',
        email: 'joao.pedro@example.com',
        avatar: 'https://i.pravatar.cc/120?img=12',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'free' as UserPlan,
        age: 19, sex: 'M' as UserSex,
        city: 'Belo Horizonte', state: 'MG',
        fanpoints: 4310, level: 3, totalSpentBRL: 0,
        followers: 84, following: 192, posts: 9,
        createdAt: days(180), lastActiveAt: minutes(45),
        isOnline: false,
        totalStreams: 2810,
      },
    },
    {
      base: {
        id: 'u_004', name: 'Camila Tanaka', handle: 'camit',
        email: 'camila.tanaka@example.com',
        avatar: 'https://i.pravatar.cc/120?img=24',
        role: 'creator' as UserRole, status: 'active' as UserStatus, plan: 'plus' as UserPlan,
        age: 31, sex: 'F' as UserSex,
        city: 'Curitiba', state: 'PR',
        fanpoints: 21450, level: 9, totalSpentBRL: 0,
        followers: 18420, following: 64, posts: 312,
        createdAt: days(640), lastActiveAt: minutes(2),
        isOnline: true, verified: true,
        totalStreams: 16720,
      },
    },
    {
      base: {
        id: 'u_005', name: 'Felipe Andrade', handle: 'felandr',
        email: 'felipe.andrade@example.com',
        avatar: 'https://i.pravatar.cc/120?img=15',
        role: 'fan' as UserRole, status: 'suspended' as UserStatus, plan: 'free' as UserPlan,
        age: 22, sex: 'M' as UserSex,
        city: 'Recife', state: 'PE',
        fanpoints: 1820, level: 2, totalSpentBRL: 49.9,
        followers: 32, following: 87, posts: 4,
        createdAt: days(76), lastActiveAt: days(2),
        isOnline: false,
        totalStreams: 920,
      },
    },
    {
      base: {
        id: 'u_006', name: 'Rafaela Souza', handle: 'rafsouza',
        email: 'rafaela.souza@example.com',
        avatar: 'https://i.pravatar.cc/120?img=44',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'superfan' as UserPlan,
        age: 29, sex: 'F' as UserSex,
        city: 'Porto Alegre', state: 'RS',
        fanpoints: 17890, level: 8, totalSpentBRL: 1942,
        followers: 532, following: 221, posts: 88,
        createdAt: days(530), lastActiveAt: minutes(8),
        isOnline: true, verified: true,
        totalStreams: 12410,
      },
    },
    {
      base: {
        id: 'u_007', name: 'Lucas Vieira', handle: 'lukvi',
        email: 'lucas.vieira@example.com',
        avatar: 'https://i.pravatar.cc/120?img=8',
        role: 'fan' as UserRole, status: 'banned' as UserStatus, plan: 'free' as UserPlan,
        age: 18, sex: 'M' as UserSex,
        city: 'Salvador', state: 'BA',
        fanpoints: 220, level: 1, totalSpentBRL: 0,
        followers: 4, following: 17, posts: 0,
        createdAt: days(34), lastActiveAt: days(12),
        isOnline: false,
        totalStreams: 88,
      },
    },
    {
      base: {
        id: 'u_008', name: 'Beatriz Cordeiro', handle: 'bicord',
        email: 'beatriz.cordeiro@example.com',
        avatar: 'https://i.pravatar.cc/120?img=49',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'plus' as UserPlan,
        age: 26, sex: 'F' as UserSex,
        city: 'Florianópolis', state: 'SC',
        fanpoints: 6540, level: 4, totalSpentBRL: 198,
        followers: 121, following: 264, posts: 17,
        createdAt: days(220), lastActiveAt: minutes(28),
        isOnline: false,
        totalStreams: 4910,
      },
    },
    {
      base: {
        id: 'u_009', name: 'Pedro Henrique Silva', handle: 'pedrohs',
        email: 'pedro.henrique@example.com',
        avatar: 'https://i.pravatar.cc/120?img=33',
        role: 'creator' as UserRole, status: 'pending' as UserStatus, plan: 'free' as UserPlan,
        age: 21, sex: 'M' as UserSex,
        city: 'Manaus', state: 'AM',
        fanpoints: 80, level: 1, totalSpentBRL: 0,
        followers: 2, following: 8, posts: 0,
        createdAt: days(2), lastActiveAt: minutes(120),
        isOnline: false,
        totalStreams: 12,
      },
    },
    {
      base: {
        id: 'u_010', name: 'Letícia Ramos', handle: 'leticiar',
        email: 'leticia.ramos@example.com',
        avatar: 'https://i.pravatar.cc/120?img=20',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'free' as UserPlan,
        age: 17, sex: 'F' as UserSex,
        city: 'Goiânia', state: 'GO',
        fanpoints: 3120, level: 3, totalSpentBRL: 29.9,
        followers: 67, following: 154, posts: 12,
        createdAt: days(140), lastActiveAt: minutes(180),
        isOnline: false,
        totalStreams: 1980,
      },
    },
    {
      base: {
        id: 'u_011', name: 'Matheus Oliveira', handle: 'matheo',
        email: 'matheus.oliveira@example.com',
        avatar: 'https://i.pravatar.cc/120?img=7',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'plus' as UserPlan,
        age: 25, sex: 'M' as UserSex,
        city: 'Fortaleza', state: 'CE',
        fanpoints: 7820, level: 5, totalSpentBRL: 312.5,
        followers: 145, following: 198, posts: 28,
        createdAt: days(310), lastActiveAt: minutes(22),
        isOnline: true,
        totalStreams: 5210,
      },
    },
    {
      base: {
        id: 'u_012', name: 'Isabela Gonçalves', handle: 'isagon',
        email: 'isabela.gon@example.com',
        avatar: 'https://i.pravatar.cc/120?img=37',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'superfan' as UserPlan,
        age: 33, sex: 'F' as UserSex,
        city: 'Brasília', state: 'DF',
        fanpoints: 22310, level: 9, totalSpentBRL: 2480,
        followers: 612, following: 134, posts: 102,
        createdAt: days(720), lastActiveAt: minutes(1),
        isOnline: true, verified: true,
        totalStreams: 19410,
      },
    },
    {
      base: {
        id: 'u_013', name: 'Gabriel Nascimento', handle: 'gabnasc',
        email: 'gabriel.nasc@example.com',
        avatar: 'https://i.pravatar.cc/120?img=11',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'free' as UserPlan,
        age: 16, sex: 'M' as UserSex,
        city: 'São Paulo', state: 'SP',
        fanpoints: 1980, level: 2, totalSpentBRL: 0,
        followers: 28, following: 92, posts: 5,
        createdAt: days(95), lastActiveAt: minutes(60),
        isOnline: false,
        totalStreams: 1210,
      },
    },
    {
      base: {
        id: 'u_014', name: 'Júlia Almeida', handle: 'juliaa',
        email: 'julia.almeida@example.com',
        avatar: 'https://i.pravatar.cc/120?img=29',
        role: 'creator' as UserRole, status: 'active' as UserStatus, plan: 'superfan' as UserPlan,
        age: 28, sex: 'F' as UserSex,
        city: 'Belém', state: 'PA',
        fanpoints: 28910, level: 10, totalSpentBRL: 0,
        followers: 32140, following: 89, posts: 489,
        createdAt: days(880), lastActiveAt: minutes(5),
        isOnline: true, verified: true,
        totalStreams: 24820,
      },
    },
    {
      base: {
        id: 'u_015', name: 'Thiago Barbosa', handle: 'thibarb',
        email: 'thiago.barbosa@example.com',
        avatar: 'https://i.pravatar.cc/120?img=18',
        role: 'fan' as UserRole, status: 'active' as UserStatus, plan: 'plus' as UserPlan,
        age: 23, sex: 'M' as UserSex,
        city: 'Vitória', state: 'ES',
        fanpoints: 5240, level: 4, totalSpentBRL: 149,
        followers: 98, following: 201, posts: 19,
        createdAt: days(195), lastActiveAt: minutes(40),
        isOnline: false,
        totalStreams: 3210,
      },
    },
    {
      base: {
        id: 'u_016', name: 'Carolina Pires', handle: 'carolp',
        email: 'carolina.pires@example.com',
        avatar: 'https://i.pravatar.cc/120?img=45',
        role: 'fan' as UserRole, status: 'pending' as UserStatus, plan: 'free' as UserPlan,
        age: 14, sex: 'F' as UserSex,
        city: 'Natal', state: 'RN',
        fanpoints: 0, level: 1, totalSpentBRL: 0,
        followers: 0, following: 0, posts: 0,
        createdAt: minutes(45), lastActiveAt: minutes(45),
        isOnline: false,
        totalStreams: 0,
      },
    },
  ] as const
).map(({ base }) => {
  const history = makeStreamHistory(base.totalStreams === 0 ? 0 : 6);
  return {
    ...base,
    phone: makePhone(),
    streamHistory: history,
    lastStream: history[0],
    termsAcceptedAt: base.createdAt,
  } satisfies User;
});

/* ============================================================
   Generator — fills out to ~140 users with realistic
   distributions so that the KPI percentages are meaningful.
   ============================================================ */

function generateExtraUsers(targetTotal: number): User[] {
  const out: User[] = [];
  const startIdx = FIXTURES.length;
  const need = targetTotal - startIdx;

  for (let i = 0; i < need; i++) {
    const sex: UserSex = pickWeighted([
      ['F', 48], ['M', 46], ['Outro', 4], ['NaoInformado', 2],
    ]);
    const firstPool =
      sex === 'F' ? FIRST_NAMES_F : sex === 'M' ? FIRST_NAMES_M : FIRST_NAMES_NB;
    const first = pick(firstPool);
    const last = `${pick(SURNAMES)} ${pick(SURNAMES)}`;
    const fullName = `${first} ${last}`;
    const cleanFirst = first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const cleanLast = pick(SURNAMES).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const handle = `${cleanFirst}.${cleanLast}${100 + i}`;

    const { city, uf } = pick(CITIES);

    // Age — 35% < 18 to match the "menores de idade" KPI
    const age = pickWeighted<number>([
      [13, 6], [14, 8], [15, 9], [16, 9], [17, 9], // ~41 minors weight
      [18, 7], [19, 7], [20, 7], [21, 7], [22, 7], [23, 6], [24, 6],
      [25, 5], [26, 5], [27, 4], [28, 4], [29, 3], [30, 3], [32, 2],
      [35, 2], [38, 1], [42, 1], [50, 1], [55, 1],
    ]);

    // Status — ~75% active
    const status: UserStatus = pickWeighted([
      ['active', 75], ['suspended', 10], ['pending', 8], ['banned', 7],
    ]);

    const role: UserRole = pickWeighted([['fan', 92], ['creator', 8]]);
    const plan: UserPlan = pickWeighted([['free', 70], ['plus', 22], ['superfan', 8]]);

    const createdDaysAgo = Math.floor(r() * 720) + 5;
    const lastActiveMinutesAgo =
      status === 'active' ? Math.floor(r() * 720) :
      status === 'pending' ? Math.floor(r() * 60 * 48) :
      Math.floor(r() * 60 * 24 * 30);

    const isOnline = status === 'active' && r() < 0.28;

    const totalStreams =
      status === 'banned' || status === 'pending'
        ? Math.floor(r() * 200)
        : Math.floor(r() * 8000) + 200;

    const historyLen = totalStreams === 0 ? 0 : Math.min(8, Math.max(3, Math.floor(r() * 8) + 3));
    const history = makeStreamHistory(historyLen);

    const id = `u_${String(startIdx + i + 1).padStart(3, '0')}`;
    const avatarSeed = (startIdx + i + 1) * 7;
    const avatar = `https://i.pravatar.cc/120?img=${(avatarSeed % 70) + 1}`;

    out.push({
      id,
      name: fullName,
      handle,
      email: `${handle.replace(/\./g, '.')}@fanverse.app`,
      avatar,
      role,
      status,
      plan,
      age,
      sex,
      phone: makePhone(),
      city,
      state: uf,
      lastStream: history[0],
      streamHistory: history,
      totalStreams,
      fanpoints: Math.floor(totalStreams * (0.15 + r() * 0.4)),
      level: Math.min(10, Math.max(1, Math.floor(totalStreams / 1500) + 1)),
      totalSpentBRL: plan === 'free' ? 0 : Math.floor(r() * 800) + 19,
      followers: Math.floor(r() * (role === 'creator' ? 20_000 : 400)),
      following: Math.floor(r() * 400),
      posts: role === 'creator' ? Math.floor(r() * 300) + 10 : Math.floor(r() * 30),
      termsAcceptedAt: days(createdDaysAgo - 0.01),
      createdAt: days(createdDaysAgo),
      lastActiveAt: minutes(lastActiveMinutesAgo),
      isOnline,
    });
  }

  return out;
}

/* ============================================================
   Final export — the union of fixtures + generator.
   Total ≈ 140 so the Users page KPIs round nicely.
   ============================================================ */

export const MOCK_USERS: User[] = [...FIXTURES, ...generateExtraUsers(140)];
