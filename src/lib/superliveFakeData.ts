/* ============================================================
 * SUPERLIVE — fake user + message pools
 *
 * Data for the brainstorm Superlive modal: a centered "live"
 * surface with Ana's transmission on top and a continuously
 * scrolling fan chat below. Until a real /api/superlive socket
 * exists we mint messages locally from these pools — picks are
 * deterministic by a session-incrementing cursor so the chat
 * never feels identically repetitive across reopens.
 *
 * Edit the pools freely; the modal cycles whatever's here. No
 * other module reads these constants, so the only risk of a
 * breaking change is if you remove the export.
 * ============================================================ */

export interface SuperliveFan {
  /** Display name shown next to the message. */
  name: string;
  /** Avatar URL — uses pravatar for deterministic placeholder
   *  images so each name keeps the same face every reload. */
  avatar: string;
  /** When set, the fan gets a verified-style blue dot next to
   *  their name. Used sparingly so the cue actually means
   *  something when it shows up. */
  verified?: boolean;
  /** Optional special accent (e.g. "moderator" / "superfan").
   *  Drives a colored tint on the message background. */
  tier?: 'superfan' | 'mod';
}

/** Pool of fake fan personas. Brazilian first names + a couple
 *  of nicknames. Mix of verified / superfan / mod tiers so the
 *  chat list has visual variety. */
export const SUPERLIVE_FANS: readonly SuperliveFan[] = [
  { name: 'Bia',        avatar: 'https://i.pravatar.cc/64?u=bia-cuiaba' },
  { name: 'Lucas M.',   avatar: 'https://i.pravatar.cc/64?u=lucas-mt' },
  { name: 'Pri Boiadeira', avatar: 'https://i.pravatar.cc/64?u=pri-boia', tier: 'superfan' },
  { name: 'Júlia C.',   avatar: 'https://i.pravatar.cc/64?u=julia-cwb' },
  { name: 'Rafa Pires', avatar: 'https://i.pravatar.cc/64?u=rafa-pires', verified: true },
  { name: 'Carol H.',   avatar: 'https://i.pravatar.cc/64?u=carol-hor' },
  { name: 'Dani Lima',  avatar: 'https://i.pravatar.cc/64?u=dani-lima' },
  { name: 'Vini OPS',   avatar: 'https://i.pravatar.cc/64?u=vini-ops', tier: 'mod' },
  { name: 'Mari Fan',   avatar: 'https://i.pravatar.cc/64?u=mari-fan' },
  { name: 'Léo Festeiro', avatar: 'https://i.pravatar.cc/64?u=leo-festa' },
  { name: 'Ana C.',     avatar: 'https://i.pravatar.cc/64?u=ana-c-fa' },
  { name: 'Bruna L.',   avatar: 'https://i.pravatar.cc/64?u=bruna-fa' },
  { name: 'Thi Ribeiro', avatar: 'https://i.pravatar.cc/64?u=thi-rib' },
  { name: 'Sami',       avatar: 'https://i.pravatar.cc/64?u=sami-sp', tier: 'superfan' },
  { name: 'Gabi Castro', avatar: 'https://i.pravatar.cc/64?u=gabi-cas', verified: true },
  { name: 'Pedro K.',   avatar: 'https://i.pravatar.cc/64?u=pedro-kg' },
  { name: 'Renata',     avatar: 'https://i.pravatar.cc/64?u=renata-bh' },
  { name: 'Isa Boia',   avatar: 'https://i.pravatar.cc/64?u=isa-boia' },
  { name: 'Murilo',     avatar: 'https://i.pravatar.cc/64?u=murilo-pr' },
  { name: 'Yas Castela', avatar: 'https://i.pravatar.cc/64?u=yas-cas', tier: 'superfan' },
  { name: 'Felipe G.',  avatar: 'https://i.pravatar.cc/64?u=felipe-go' },
  { name: 'Naty Tour',  avatar: 'https://i.pravatar.cc/64?u=naty-tur' },
  { name: 'Cris Show',  avatar: 'https://i.pravatar.cc/64?u=cris-sho', tier: 'mod' },
  { name: 'Marina',     avatar: 'https://i.pravatar.cc/64?u=marina-rs' },
  { name: 'Caio',       avatar: 'https://i.pravatar.cc/64?u=caio-mg' },
  { name: 'Vivi P.',    avatar: 'https://i.pravatar.cc/64?u=vivi-p' },
  { name: 'Ana B.',     avatar: 'https://i.pravatar.cc/64?u=ana-b-fa' },
  { name: 'Bea Star',   avatar: 'https://i.pravatar.cc/64?u=bea-star' },
  { name: 'Léa Cantora', avatar: 'https://i.pravatar.cc/64?u=lea-canta' },
  { name: 'Roberto',    avatar: 'https://i.pravatar.cc/64?u=roberto-pa' },
];

/** Pool of fan-style messages. Mix of emoji bursts, song
 *  requests, and quick reactions so the chat reads as a real
 *  show. Lengths are intentionally short — long messages would
 *  blow the chat row height and the rapid stream would feel
 *  laggy at scroll time. */
export const SUPERLIVE_MESSAGES: readonly string[] = [
  'BOIADEIRA 🤠❤️',
  'manda Pipoco!!!',
  'TE AMO ANA 🥺💖',
  'AHHHH não acredito 😍',
  'Pipoco PIPOCO PIPOCO',
  'que linda 😭',
  'Brasil te ama!! 🇧🇷',
  'canta Solteiro Forçado!!!',
  'PERFEITAAAA',
  'manda um beijo 🥹',
  'gente que linda',
  'aaaaaa que voz',
  'minha rainha 👑',
  'Erro Gostoso!!!',
  'sou do Paraná, te amo Ana!',
  'já chorei 😭🥰',
  'estamos juntos contigo 💜',
  'Saudades dos shows!! ❤️',
  'manda um oi pro Rio!!',
  'Ana ❤️ Brasil',
  'Q SHOW MARAVILHOSO',
  'pipoco no repeat hoje',
  'cantando junto aqui!',
  'que figurino lindo 😍',
  'Curitiba te ama 🌲',
  'JÁ CHOROU AQUI',
  'sucesso sempre Ana!',
  'manda Boiadeira 💛',
  'queremos Tour Brasil!',
  'Maringá no chat 🇧🇷',
  'meu Deus que momento',
  'NOSSA QUE VOZ',
  'Estamos ouvindo do Norte ❤️',
  'É a melhor cantora 👑',
  'minha trilha sonora 💖',
  'AMOOOOO 🥹',
  'esse vestido tá lindo!',
  'Tomara que faça show aqui',
  '😍😍😍',
  'manda Nosso Quadro!!!',
  'parabéns Ana ❤️🎉',
  'tropa da boiadeira no chat!',
  'BR no chat ❤️',
  'manda pra Bahia 🌴',
  'Goiás na escuta!! 💛',
  'sigam pra mim 👑',
  'que noite linda',
  'a 1ª da fila aqui 🥳',
  'meu coração 💗',
  'É HOJE',
  'TE AMO MUITO 💞',
  'já tô gravando 📹',
  'lindeza pura ✨',
  'PARABÉNS',
  'manda Nicotina! 🥹',
];
