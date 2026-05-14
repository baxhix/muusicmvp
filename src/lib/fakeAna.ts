/**
 * Fake Ana Castela contact — a simulated VIP DM that surfaces in the
 * chat list as if the artist herself were messaging the fan. Lives
 * entirely client-side: no rows in the conversations / messages /
 * users tables. The fan can read her messages, see them auto-arrive
 * every couple of minutes, and even type a "reply" that she answers
 * with a canned thank-you.
 *
 * Wired in `useChatLiveWithFakes` (the wrapper around useChatLive
 * that merges this fake into the real conversation list).
 */
import type { ApiConversationSummary, ApiMessage } from './api/types';

/** Stable id used throughout the fake-chat plumbing. */
export const FAKE_ANA_USER_ID = 'fake-ana-castela';
export const FAKE_ANA_CONVERSATION_ID = 'fake-conv-ana-castela';

/** Avatar path — drop the new portrait at this exact file to update.
 *  Falls back to the existing universe cover if the file is missing. */
export const FAKE_ANA_AVATAR_URL = '/ana-castela.png';

/** Second simulated contact: an official "Central Ana Castela"
 *  account that posts updates more in the voice of a community
 *  manager / news desk than the artist herself. */
export const FAKE_CENTRAL_USER_ID = 'fake-central-anacastela';
export const FAKE_CENTRAL_CONVERSATION_ID = 'fake-conv-central-anacastela';
export const FAKE_CENTRAL_AVATAR_URL = '/central-anacastela.png';

/** Tracks shown in the chat header when each contact's thread is
 *  active. Both currently point to the launch single — easy to
 *  override per-contact later. */
export const FAKE_CENTRAL_NOW_PLAYING = {
  title: 'Solta o Pipoco',
  artist: 'Ana Castela',
};

/** Track that powers the now-playing line in the chat header. */
export const FAKE_ANA_NOW_PLAYING = {
  title: 'Solta o Pipoco',
  artist: 'Ana Castela',
};

/**
 * Featured launch message — pinned as Ana's very first message in
 * the conversation. Includes the new music video URL so the inline
 * video preview component renders the YouTube embed below the text.
 */
const VIDEO_LAUNCH_MESSAGE = `Oi, tropa do Chapelão! 🤠 Acabou de sair meu clipe novo — corre lá e me conta o que achou! 💚

https://www.youtube.com/watch?v=CKNjiHKiNvM`;

/** Live photos dropped on chat as if Ana/Central just posted them.
 *  Local paths under /public/feed (see deploy notes — the actual
 *  PNGs need to be saved at these exact filenames, one per image
 *  attached to the source request). MessageBody auto-detects these
 *  paths via LOCAL_IMAGE_PATH_REGEX and renders them inline as
 *  attachments below any caption text. */
const FESPOP_PHOTO_MESSAGES: readonly string[] = [
  'Direto do palco do FESPOP 🤠 muito amor pra tropa do Chapelão. Quem tava aí? 💚\n/feed/ana-castela-fespop-1.png',
  'Foto que peguei agorinha pra vocês, antes da próxima música 📸\n/feed/ana-castela-fespop-2.png',
  'O figurino dessa noite tava demais, né? Vocês merecem 💛\n/feed/ana-castela-fespop-3.png',
  'Esse foi um dos momentos mais especiais — sentindo cada palavra. Obrigada 💚\n/feed/ana-castela-fespop-4.png',
];

/** Pool of random messages auto-posted by Ana every two minutes. The
 *  scheduler picks one at random and posts it as if she were live
 *  on the chat. Tone leans warm + fan-connection — quick personal
 *  voice notes, never broadcast-marketing.
 *
 *  Note: the FESPOP photo messages above ARE included in the pool
 *  via spread, so they surface naturally alongside the text-only
 *  blurbs. */
const RANDOM_MESSAGES: readonly string[] = [
  ...FESPOP_PHOTO_MESSAGES,
  // ── Warmth + presence ───────────────────────────────────────
  'Boiadeira chegou! 🤠 Como tá o coração de vocês hoje?',
  'Acabei de chegar do estúdio e já vim aqui matar a saudade. 💚',
  'Tô com vocês até dormir. Quem aí ainda tá acordado?',
  'Bom dia, minha tropa do Chapelão! Hoje vai ser dia bom — sinto isso aqui no peito.',
  'Boa noite, gente. Manda um coração antes de eu dormir 💚',
  'Saudade de vocês desde o último show. Quem foi me conta a melhor parte 👇',
  'Sem vocês não tem Boiadeira. Tô aqui pra lembrar disso todo dia.',
  'Tô tomando café aqui pensando: como vocês são especiais pra mim.',

  // ── Convite pra ação (interação) ────────────────────────────
  'Manda pra mim: qual minha música tu escuta mais? Quero ver tudo!',
  'Conta uma história aí: onde você estava quando ouviu Pipoco a primeira vez?',
  'Já tem boiadeiro/boiadeira aqui que vai pro próximo show? Avisa nos comentários.',
  'Posta um vídeo seu cantando comigo e me marca, viu? Eu vou olhar.',
  'Que tal hoje a gente fazer um replay maratona nas minhas músicas? Bora?',
  'Fala uma coisa boa que aconteceu hoje. Quero ler todas.',
  'Quem tá ouvindo agora e onde? Comenta aí — quero mapear minha tropa do Chapelão 🌎',

  // ── Vida + rotina (humaniza) ────────────────────────────────
  'Hoje foi dia de ensaio pesado. Quase morri, mas vale a pena por vocês 🎸',
  'Pegando estrada de novo. Manda música boa pra eu ouvir? 🎶',
  'Tô comendo açaí enquanto leio vocês aqui. Que delícia esse momento.',
  'Acabei de tomar banho de cachoeira no interior. Recomendo demais.',
  'Bastidor: tô vestindo o chapéu mais estiloso do mundo agora 🤠 Foto vem depois.',

  // ── Country / sertão vibe ───────────────────────────────────
  'Hoje é dia de country forte na caixa? Bota 🎸 nos comentários se sim.',
  'Quem aí gosta da Boiadeira mais que da Ana? Acho que vocês me amam mais de chapéu kkk',
  'O sertão tem cura, viu? Quando bater tristeza, dá replay no nosso som.',
  'A vida no campo me ensinou tudo. E vocês me ensinam o resto 💚',

  // ── Gratidão + motivação ────────────────────────────────────
  'Obrigada por estarem aqui. Sério mesmo. Vocês mudam minha vida.',
  'Lembrete: sonho não tem prazo de validade. Eu sou prova disso 💚',
  'Acredita em você. Eu acredito.',
  'Vocês me fazem cantar mais alto, mais bonito. É verdade.',
  'A gente vai conquistar muita coisa juntos ainda. Cola comigo.',

  // ── Música ao vivo / lançamento ─────────────────────────────
  'Surpresa nova vindo aí essa semana. Fica de olho aqui no muusic 👀',
  'Quem aí ainda não viu meu clipe novo? Cola no perfil — link na bio.',
  'Já tô gravando música nova com o pessoal. Em breve mais notícia.',
];

/** Canned thank-you replies for when the fan types something to her.
 *  Picked at random so consecutive reactions don't feel identical. */
const REPLY_MESSAGES: readonly string[] = [
  'Obrigada, meu boiadeiro/minha boiadeira 💚',
  'Tô lendo aqui, viu? Manda mais!',
  'Vocês fazem meus dias 🤠',
  'Te amo, fã! 💚💚',
  'Mensagem recebida. Bora pro próximo show!',
];

export function pickRandomAnaMessage(): string {
  return RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
}

export function pickRandomAnaReply(): string {
  return REPLY_MESSAGES[Math.floor(Math.random() * REPLY_MESSAGES.length)];
}

/** Same FESPOP photo set rerendered in the Central account's
 *  community-news voice. Mixed into CENTRAL_MESSAGES below. */
const CENTRAL_FESPOP_MESSAGES: readonly string[] = [
  '🎤 Bastidores do show no FESPOP — registro oficial. Compartilha com a tropa!\n/feed/ana-castela-fespop-1.png',
  '📸 Mais um clique exclusivo da noite. Foto: equipe Central.\n/feed/ana-castela-fespop-2.png',
  '⭐ Ana subiu ao palco com o look assinado pela Tropa do Chapelão. Olha que potência!\n/feed/ana-castela-fespop-3.png',
  '🔥 Cena marcante da apresentação no FESPOP. Esse momento entrou pra história.\n/feed/ana-castela-fespop-4.png',
];

/** Pool of messages for the Central Ana Castela community account.
 *  Tone is informative + community-news, distinct from the artist's
 *  warm personal voice — covers tour dates, releases, contests,
 *  fan-club perks. */
const CENTRAL_MESSAGES: readonly string[] = [
  ...CENTRAL_FESPOP_MESSAGES,
  // Tour / shows
  '🗓️ Próximo show oficial: Festa do Peão (Barretos). Garanta seu ingresso pelo site da Central.',
  '📍 Cidades confirmadas pra 2026: Goiânia, Cuiabá, Sinop, Rio Verde. Lista completa em breve.',
  'Hoje tem a Boiadeira no palco do Caldas Country — quem vai? Comenta a cidade aí 👇',
  '⚠️ Lembrete: ingressos da turnê só são oficiais pelos canais autorizados. Cuidado com revendas.',

  // Lançamentos / clipes
  '🎵 Top 3 da semana: Pipoco, Boiadeira, Erro Gostoso. Bombando todo o sertão.',
  'Clipe novo na conta oficial — passa lá e curte, isso ajuda a galera a chegar mais longe 💚',
  '📈 Pipoco passou de 500M de plays. Vocês são responsáveis por isso. Obrigada de coração.',
  'Próximo lançamento dia 28. Fica de olho aqui na Central pra ser o primeiro a ouvir.',

  // Comunidade / Fanverse
  'Tropa do Chapelão tá crescendo todo dia. Bem-vinda, gente nova! 🤠',
  '💚 Notícia: Fanverse oficial da Ana ganhou ranking de superfãs. Conferiram já?',
  'Posta aqui no muusic uma foto cantando música da Ana e ganhe pontos no ranking 📸',
  'Aviso importante: contas com selo verificado são oficiais. Outras se passando por Ana, denunciem.',

  // Concursos / interação
  '🎁 Sorteio essa semana: meet & greet em Barretos. Detalhes amanhã na Central.',
  'Quem participa do quiz semanal sobre as músicas? Sextou é dia.',
  'Indique uma cidade pra próxima turnê. Nas que mais aparecerem, a gente vai 🚌',

  // Bastidores / curiosidades
  '👀 Bastidor exclusivo: bate-papo da Ana com a tropa do Chapelão amanhã às 18h.',
  'Sabia? "Pipoco" foi gravada em 4 takes. A Ana disse que o tom só fechou no 4º 🎶',
  '📸 Foto inédita do ensaio chegando na Central daqui a pouco. Não percam.',
];

export function pickRandomCentralMessage(): string {
  return CENTRAL_MESSAGES[
    Math.floor(Math.random() * CENTRAL_MESSAGES.length)
  ];
}

/** Stable createdAt for the launch message — derived once at module
 *  load so re-renders don't reshuffle the message ordering. Anchored
 *  to "five minutes before mount" so the inline relative time labels
 *  feel right. */
const LAUNCH_TS = new Date(Date.now() - 5 * 60 * 1000).toISOString();

/** Build the initial Ana → fan message stream — just the launch
 *  message at module load. The 2-minute scheduler appends more
 *  later (see useChatLiveWithFakes). */
export function buildInitialAnaMessages(): ApiMessage[] {
  return [
    {
      id: 'fake-ana-msg-launch',
      conversationId: FAKE_ANA_CONVERSATION_ID,
      senderId: FAKE_ANA_USER_ID,
      body: VIDEO_LAUNCH_MESSAGE,
      createdAt: LAUNCH_TS,
      senderName: 'Ana Castela',
      senderAvatarUrl: FAKE_ANA_AVATAR_URL,
    },
  ];
}

/** Build the conversation summary that appears in the chat dock +
 *  sidebar. `lastMessage` and `unreadCount` are caller-supplied so
 *  they can reflect live state (latest message + read/unread). */
export function buildAnaConversation(args: {
  lastMessage: ApiMessage | null;
  unreadCount: number;
}): ApiConversationSummary {
  return {
    id: FAKE_ANA_CONVERSATION_ID,
    type: 'dm',
    createdAt: LAUNCH_TS,
    lastMessage: args.lastMessage
      ? {
          id: args.lastMessage.id,
          body: args.lastMessage.body,
          senderId: args.lastMessage.senderId,
          createdAt: args.lastMessage.createdAt,
        }
      : null,
    otherUser: {
      id: FAKE_ANA_USER_ID,
      name: 'Ana Castela',
      avatarUrl: FAKE_ANA_AVATAR_URL,
      // The artist's verified badge — drives the blue check on her
      // avatar across the dock, sidebar, and chat header.
      verified: true,
    },
    unreadCount: args.unreadCount,
  };
}

/** Initial buffer for the Central account — single welcome message
 *  pinned at first-mount so the contact never reads as empty. */
const CENTRAL_WELCOME_TS = new Date(Date.now() - 3 * 60 * 1000).toISOString();
export function buildInitialCentralMessages(): ApiMessage[] {
  return [
    {
      id: 'fake-central-msg-welcome',
      conversationId: FAKE_CENTRAL_CONVERSATION_ID,
      senderId: FAKE_CENTRAL_USER_ID,
      body: 'Oi, tropa! 🤠 Aqui é a Central Ana Castela — canal oficial pra novidades, datas de show e bastidores. Bem-vinda(o)!',
      createdAt: CENTRAL_WELCOME_TS,
      senderName: 'Central Ana Castela',
      senderAvatarUrl: FAKE_CENTRAL_AVATAR_URL,
    },
  ];
}

/** Mirror of buildAnaConversation for the Central account. */
export function buildCentralConversation(args: {
  lastMessage: ApiMessage | null;
  unreadCount: number;
}): ApiConversationSummary {
  return {
    id: FAKE_CENTRAL_CONVERSATION_ID,
    type: 'dm',
    createdAt: CENTRAL_WELCOME_TS,
    lastMessage: args.lastMessage
      ? {
          id: args.lastMessage.id,
          body: args.lastMessage.body,
          senderId: args.lastMessage.senderId,
          createdAt: args.lastMessage.createdAt,
        }
      : null,
    otherUser: {
      id: FAKE_CENTRAL_USER_ID,
      name: 'Central Ana Castela',
      avatarUrl: FAKE_CENTRAL_AVATAR_URL,
      verified: true,
    },
    unreadCount: args.unreadCount,
  };
}
