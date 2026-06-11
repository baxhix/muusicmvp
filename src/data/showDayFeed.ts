/* ============================================================
 * HOJE TEM SHOW — pools de conteúdo da simulação.
 *
 * Tudo aqui é fixture client-side: senders fake, mensagens
 * pt-BR por fase, legendas e fotos "exclusivas" da Central Ana
 * Castela e a lista de presentes no show. Nada é persistido —
 * o useShowDaySimulation cicla esses pools com cursores
 * determinísticos (mesmo padrão do ShowLiveStage/superlive).
 *
 * Identidades reusam o estilo pravatar determinístico do
 * fanverseSearchMocks (mesmo seed → mesma cara em qualquer
 * superfície) com cidades remapeadas pra órbita de Salvador —
 * quem está "presente no show" mora perto do venue.
 * ============================================================ */

export interface SimSender {
  name: string;
  avatarUrl: string;
  /** Central Ana Castela — VerifiedBadge + accent de marca no bubble. */
  isStaff?: boolean;
  /** Chip "SUPER-FÃ" ao lado do nome. */
  role?: 'super-fa' | 'fa';
}

export interface SimShowMessage {
  /** Monotônico; negativos = seed inicial (precedente ShowLiveStage). */
  id: number;
  sender: SimSender;
  body?: string;
  /** Foto exclusiva (só a Central manda). Dimensões explícitas
   *  evitam layout shift no stream. */
  photo?: { url: string; width: number; height: number };
  /** Mensagem local do próprio usuário (composer). */
  isSelf?: boolean;
}

export interface ShowAttendee {
  id: string;
  name: string;
  city: string;
  avatarUrl: string;
  role: 'super-fa' | 'fa';
}

const avatar = (seed: string) =>
  `https://i.pravatar.cc/120?u=${encodeURIComponent(seed)}`;

/* ── Senders do chat ─────────────────────────────────────────── */

export const CENTRAL_SENDER: SimSender = {
  name: 'Central Ana Castela',
  avatarUrl: '/central-anacastela.png',
  isStaff: true,
};

/** ~24 fãs que comentam no chat do show. Subconjunto com role
 *  'super-fa' ganha o chip — mesma proporção visual do Superchat. */
export const SHOW_DAY_FANS: readonly SimSender[] = [
  { name: 'Bia Castela',   avatarUrl: avatar('bia-ssa'),      role: 'super-fa' },
  { name: 'Rafael Oliveira', avatarUrl: avatar('rafael-oliveira-salvador') },
  { name: 'Liz Tavares',   avatarUrl: avatar('liz-tavares-salvador'), role: 'super-fa' },
  { name: 'Marina Sales',  avatarUrl: avatar('marina-ssa') },
  { name: 'Pri Boiadeira', avatarUrl: avatar('pri-boia'),     role: 'super-fa' },
  { name: 'Lucas M.',      avatarUrl: avatar('lucas-lauro') },
  { name: 'Carol H.',      avatarUrl: avatar('carol-camacari') },
  { name: 'Dani Lima',     avatarUrl: avatar('dani-feira') },
  { name: 'Thi Ribeiro',   avatarUrl: avatar('thi-itabuna') },
  { name: 'Yas Castela',   avatarUrl: avatar('yas-cas'),      role: 'super-fa' },
  { name: 'Pedro K.',      avatarUrl: avatar('pedro-aracaju') },
  { name: 'Renata',        avatarUrl: avatar('renata-vca') },
  { name: 'Isa Boia',      avatarUrl: avatar('isa-boia') },
  { name: 'Murilo',        avatarUrl: avatar('murilo-ssa') },
  { name: 'Gabi Castro',   avatarUrl: avatar('gabi-cas'),     role: 'super-fa' },
  { name: 'Felipe G.',     avatarUrl: avatar('felipe-lauro') },
  { name: 'Naty Tour',     avatarUrl: avatar('naty-tur') },
  { name: 'Marina RS',     avatarUrl: avatar('marina-rs') },
  { name: 'Caio',          avatarUrl: avatar('caio-feira') },
  { name: 'Vivi P.',       avatarUrl: avatar('vivi-p') },
  { name: 'Bea Star',      avatarUrl: avatar('bea-star'),     role: 'super-fa' },
  { name: 'Léo Festeiro',  avatarUrl: avatar('leo-festa') },
  { name: 'Sami',          avatarUrl: avatar('sami-ssa') },
  { name: 'Bruna L.',      avatarUrl: avatar('bruna-camacari') },
];

/* ── Mensagens por fase ──────────────────────────────────────── */

/** Fase announced — expectativa, deslocamento, fila. */
export const SHOW_DAY_MESSAGES_ANNOUNCED: readonly string[] = [
  'É HOJE BOIADEIRA 🤠🔥',
  'já tô a caminho da Fire Arena!!',
  'quem mais vai??',
  'saindo de Feira de Santana agora 🚗',
  'HOJE TEM SHOW gente 😭❤️',
  'contando as horas ⏳',
  'a fila já tá GIGANTE',
  'primeira vez vendo a Ana ao vivo 🥹',
  'alguém na pista premium?',
  'bora cantar Pipoco juntos!!',
  'cheguei na arena, tá lindo demais',
  'o telão já tá ligado!!!',
  'Salvador vai tremer hoje 🌴',
  'trouxe até a plaquinha 🪧',
  'meu look boiadeira tá pronto 🤠',
  'estou MUITO ansiosa',
  'já tem gente acampada desde cedo kkk',
  'vai passar o setlist novo??',
  'sonho de consumo realizado hoje',
  'energia tá surreal já 🔥',
];

/** Fase live — hype de show acontecendo. */
export const SHOW_DAY_MESSAGES_LIVE: readonly string[] = [
  'COMEÇOU AAAAA 🔥🔥🔥',
  'PIPOCO PIPOCO PIPOCO',
  'a Ana tá LINDA hoje 😍',
  'que abertura foi essa???',
  'tô na grade!! vista perfeita',
  'BOIADEIRA 🤠❤️',
  'esse show tá HISTÓRICO',
  'canta Solteiro Forçado!!!',
  'o som tá absurdo de bom',
  'CHOREI no Nosso Quadro 😭',
  'os fogos!!! 🎆',
  'a arena inteira cantando junto',
  'melhor noite da minha vida',
  'TE AMO ANA 🥺💖',
  'esse figurino é um espetáculo',
  'quem tá em casa tá perdendo',
  'a bateria do meu cel não vai aguentar 📹',
  'manda um beijo pra Bahia!!',
  'Erro Gostoso AO VIVO é outra coisa',
  'q telão gigante meu deus',
  'dançando desde a primeira música 💃',
  'NOSSA QUE VOZ',
  'o drone passou aqui em cima!!',
  'já quero o próximo show',
  'minha rainha 👑',
  'PERFEITAAAA',
  'arrepiada da cabeça aos pés',
  'gente o palco SUBIU',
  'a Ana acenou pra gente!!! 😭',
  'tropa da boiadeira presente 🤠',
  'cantem mais alto Salvador!!',
  'isso não é um show é um filme',
  'AAAAAAAA 😍😍😍',
  'a pirotecnia tá insana 🎇',
  'levantem os celulares ✨',
  'show impecável até agora',
  'que momento histórico mano',
  'o coro da arena inteira 🥹',
  'sem palavras pra essa noite',
  'JÁ QUERO REPETIR',
];

/* ── Central Ana Castela — legendas + fotos exclusivas ───────── */

export const CENTRAL_CAPTIONS_ANNOUNCED: readonly string[] = [
  'Hoje tem show! 🤠 Fire Arena, Salvador — portões abertos às 18h.',
  'Passando o som agora… vem coisa linda por aí 🎶',
  'A Boiadeira já está na cidade! Quem aí vem pro show de hoje?',
  'Equipe a postos na Fire Arena. Falta pouco! ⏳',
  'Dica: chegue cedo, a expectativa é de casa cheia 🔥',
  'O palco de hoje está ESPECIAL. Confia. ✨',
];

export const CENTRAL_CAPTIONS_LIVE: readonly string[] = [
  'Bastidores agora 📸 exclusivo pra quem está no Fanverse!',
  'A vista do palco está ASSIM. Salvador, vocês são gigantes! 🔥',
  'Momento exato do Pipoco 🍿 olha essa arena!',
  'Foto exclusiva direto da coxia 🤫',
  'A Boiadeira dominou a Fire Arena 🤠👑',
  'Esse mar de gente… arrepia! 📷',
  'Registro oficial da noite — guarda essa memória ❤️',
  'O figurino de hoje em detalhe ✨',
  'Cliques exclusivos do segundo ato 🎬',
  'Salvador entrou pra história da tour hoje 🌴🔥',
];

/** 8 fotos reais de show (JPEG ~70-120KB, dimensões originais dos
 *  PNGs do feed). O Lightbox usa essas mesmas URLs como full-res. */
export const SHOW_DAY_PHOTOS: ReadonlyArray<{
  url: string;
  width: number;
  height: number;
}> = [
  { url: '/show-day/show-1.jpg', width: 623, height: 760 },
  { url: '/show-day/show-2.jpg', width: 620, height: 761 },
  { url: '/show-day/show-3.jpg', width: 621, height: 766 },
  { url: '/show-day/show-4.jpg', width: 624, height: 762 },
  { url: '/show-day/show-5.jpg', width: 584, height: 855 },
  { url: '/show-day/show-6.jpg', width: 588, height: 861 },
  { url: '/show-day/show-7.jpg', width: 586, height: 860 },
  { url: '/show-day/show-8.jpg', width: 626, height: 859 },
];

/* ── Presentes no show ───────────────────────────────────────── */

/** Base do contador "X fãs fizeram check-in" por fase (o drift fica no
 *  useShowDaySimulation). */
export const ATTENDEES_BASE_ANNOUNCED = 880;
export const ATTENDEES_BASE_LIVE = 1_243;

/** ~30 fãs "no local" — lista estática (o número grande é que
 *  drifta). Cidades na órbita de Salvador pra leitura coerente. */
export const SHOW_ATTENDEES: readonly ShowAttendee[] = [
  { id: 'sa-01', name: 'Bia Castela',     city: 'Salvador',             avatarUrl: avatar('bia-ssa'),       role: 'super-fa' },
  { id: 'sa-02', name: 'Rafael Oliveira', city: 'Salvador',             avatarUrl: avatar('rafael-oliveira-salvador'), role: 'fa' },
  { id: 'sa-03', name: 'Liz Tavares',     city: 'Salvador',             avatarUrl: avatar('liz-tavares-salvador'), role: 'super-fa' },
  { id: 'sa-04', name: 'Marina Sales',    city: 'Lauro de Freitas',     avatarUrl: avatar('marina-ssa'),    role: 'fa' },
  { id: 'sa-05', name: 'Pri Boiadeira',   city: 'Camaçari',             avatarUrl: avatar('pri-boia'),      role: 'super-fa' },
  { id: 'sa-06', name: 'Lucas M.',        city: 'Lauro de Freitas',     avatarUrl: avatar('lucas-lauro'),   role: 'fa' },
  { id: 'sa-07', name: 'Carol H.',        city: 'Camaçari',             avatarUrl: avatar('carol-camacari'), role: 'fa' },
  { id: 'sa-08', name: 'Dani Lima',       city: 'Feira de Santana',     avatarUrl: avatar('dani-feira'),    role: 'fa' },
  { id: 'sa-09', name: 'Thi Ribeiro',     city: 'Itabuna',              avatarUrl: avatar('thi-itabuna'),   role: 'fa' },
  { id: 'sa-10', name: 'Yas Castela',     city: 'Salvador',             avatarUrl: avatar('yas-cas'),       role: 'super-fa' },
  { id: 'sa-11', name: 'Pedro K.',        city: 'Aracaju',              avatarUrl: avatar('pedro-aracaju'), role: 'fa' },
  { id: 'sa-12', name: 'Renata',          city: 'Vitória da Conquista', avatarUrl: avatar('renata-vca'),    role: 'fa' },
  { id: 'sa-13', name: 'Isa Boia',        city: 'Salvador',             avatarUrl: avatar('isa-boia'),      role: 'fa' },
  { id: 'sa-14', name: 'Murilo',          city: 'Salvador',             avatarUrl: avatar('murilo-ssa'),    role: 'fa' },
  { id: 'sa-15', name: 'Gabi Castro',     city: 'Simões Filho',         avatarUrl: avatar('gabi-cas'),      role: 'super-fa' },
  { id: 'sa-16', name: 'Felipe G.',       city: 'Lauro de Freitas',     avatarUrl: avatar('felipe-lauro'),  role: 'fa' },
  { id: 'sa-17', name: 'Naty Tour',       city: 'Salvador',             avatarUrl: avatar('naty-tur'),      role: 'fa' },
  { id: 'sa-18', name: 'Marina RS',       city: 'Alagoinhas',           avatarUrl: avatar('marina-rs'),     role: 'fa' },
  { id: 'sa-19', name: 'Caio',            city: 'Feira de Santana',     avatarUrl: avatar('caio-feira'),    role: 'fa' },
  { id: 'sa-20', name: 'Vivi P.',         city: 'Salvador',             avatarUrl: avatar('vivi-p'),        role: 'fa' },
  { id: 'sa-21', name: 'Bea Star',        city: 'Salvador',             avatarUrl: avatar('bea-star'),      role: 'super-fa' },
  { id: 'sa-22', name: 'Léo Festeiro',    city: 'Camaçari',             avatarUrl: avatar('leo-festa'),     role: 'fa' },
  { id: 'sa-23', name: 'Sami',            city: 'Salvador',             avatarUrl: avatar('sami-ssa'),      role: 'fa' },
  { id: 'sa-24', name: 'Bruna L.',        city: 'Camaçari',             avatarUrl: avatar('bruna-camacari'), role: 'fa' },
  { id: 'sa-25', name: 'João Vitor',      city: 'Salvador',             avatarUrl: avatar('joao-vitor-ssa'), role: 'fa' },
  { id: 'sa-26', name: 'Larissa F.',      city: 'Ilhéus',               avatarUrl: avatar('larissa-ilheus'), role: 'fa' },
  { id: 'sa-27', name: 'Duda Mota',       city: 'Salvador',             avatarUrl: avatar('duda-mota'),     role: 'super-fa' },
  { id: 'sa-28', name: 'Kaique',          city: 'Juazeiro',             avatarUrl: avatar('kaique-jua'),    role: 'fa' },
  { id: 'sa-29', name: 'Tainá B.',        city: 'Salvador',             avatarUrl: avatar('taina-ssa'),     role: 'fa' },
  { id: 'sa-30', name: 'Wesley Boia',     city: 'Santo Antônio de Jesus', avatarUrl: avatar('wesley-saj'),  role: 'fa' },
];
