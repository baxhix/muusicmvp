'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './ProfileCardStack.module.css';

/**
 * ProfileCardStack — Motion "Card stack" pattern aplicado a
 * cards de perfil compactos do FanverseSearch. 180×230 cada,
 * fingindo um stack tipo Tinder/Bumble onde o user pode dar
 * swipe pra revelar o próximo perfil.
 *
 * Per spec:
 *  - foto destacada (ocupa o topo do card)
 *  - nome + cidade
 *  - badge "Top 10/20/50"
 *  - emojis de reações (3 fixos: 🔥 ❤️ 👏)
 *  - botão de "enviar mensagem"
 *  - 5 usuários mocados
 *
 * Mecânica do stack:
 *  - 3 cards visíveis simultaneamente: topo (scale 1), -1 (0.94
 *    translateY 10px), -2 (0.88 translateY 20px). Resto invisível
 *    atrás.
 *  - Swipe horizontal no top card: >80px ou velocity alta → exit
 *    pelo lado correspondente + dismiss (vai pro final do array).
 *  - Tap nos emojis dispara feedback de scale (fonte de
 *    interatividade local).
 *  - Botão "Enviar mensagem" gradient brand pill.
 */

interface ProfileCard {
  id: string;
  name: string;
  city: string;
  country: string;
  avatarUrl: string;
  topRank: 10 | 20 | 50;
  /* Match suffix vindo do mesmo padrão dos cards horizontais
   *  (FanverseMatch.suffix em fanverseSearchMocks). Ex.:
   *  "curtem Pipoco há mais tempo". Renderizado abaixo do botão
   *  "Enviar mensagem" pra dar contexto da afinidade. */
  matchSuffix: string;
}

/* 5 perfis mocados — mix de top 10/20/50 com matchSuffix
 *  reaproveitado dos MATCHES horizontais. */
const MOCK_PROFILES: ProfileCard[] = [
  {
    id: 'p1',
    name: 'Helena Bastos',
    city: 'Recife',
    country: 'Brasil',
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
    topRank: 10,
    matchSuffix: 'curtem Pipoco há mais tempo',
  },
  {
    id: 'p2',
    name: 'Rafael Tavares',
    city: 'Lisboa',
    country: 'Portugal',
    avatarUrl: 'https://i.pravatar.cc/300?img=33',
    topRank: 50,
    matchSuffix: 'compartilham 8 playlists',
  },
  {
    id: 'p3',
    name: 'Cecília Pessoa',
    city: 'Curitiba',
    country: 'Brasil',
    avatarUrl: 'https://i.pravatar.cc/300?img=44',
    topRank: 20,
    matchSuffix: 'foram aos mesmos 3 shows',
  },
  {
    id: 'p4',
    name: 'Augusto Tafur',
    city: 'Asunción',
    country: 'Paraguai',
    avatarUrl: 'https://i.pravatar.cc/300?img=12',
    topRank: 50,
    matchSuffix: 'curtem o mesmo álbum: Boiadeira',
  },
  {
    id: 'p5',
    name: 'Vitória Camargo',
    city: 'Goiânia',
    country: 'Brasil',
    avatarUrl: 'https://i.pravatar.cc/300?img=56',
    topRank: 10,
    matchSuffix: 'são superfãs há 2 anos',
  },
];

/* Reações disponíveis no card. Per spec atualizado ❤️ removido
 *  (vira heart toggle separado ao lado do nome). Mantemos 👀
 *  + 👏 — sinais de "observando" e "aplaudindo". */
const REACTIONS = ['👀', '👏'];

export default function ProfileCardStack() {
  /* Stack chronologic — primeiro = mais antigo, último = topo.
   *  Dismiss recicla o top pro começo do array pra loop infinito. */
  const [stack, setStack] = useState<ProfileCard[]>(MOCK_PROFILES);

  const dismissTop = () => {
    setStack((arr) => {
      if (arr.length < 2) return arr;
      const top = arr[arr.length - 1];
      return [top, ...arr.slice(0, arr.length - 1)];
    });
  };

  /* Renderiza só os top 3 cards do stack pra perf — os 2 restantes
   *  ficam invisíveis atrás (sem mount). */
  const visible = stack.slice(-3);

  return (
    <div className={styles.root} aria-label="Perfis em destaque">
      <AnimatePresence initial={false}>
        {visible.map((profile, i) => {
          const depth = visible.length - 1 - i;
          const isTop = depth === 0;
          /* Per spec atualizado "Desloque os cards que estão
           *  atrás" — cards de trás agora têm offset lateral
           *  alternado (-1 = esq, +1 = dir) em vez de só Y
           *  descendente. Sinaliza mais explicitamente que tem
           *  outros cards no stack. */
          const offsetSide = depth === 1 ? -1 : depth === 2 ? 1 : 0;
          const peekX = offsetSide * 14;
          const peekY = depth * 8;
          const peekRotate = offsetSide * -3;
          const peekScale = 1 - depth * 0.05;
          const peekOpacity = 1 - depth * 0.16;

          return (
            <ProfileCardItem
              key={profile.id}
              profile={profile}
              isTop={isTop}
              depth={depth}
              peekX={peekX}
              peekY={peekY}
              peekRotate={peekRotate}
              peekScale={peekScale}
              peekOpacity={peekOpacity}
              onDismiss={dismissTop}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

interface ProfileCardItemProps {
  profile: ProfileCard;
  isTop: boolean;
  depth: number;
  peekX: number;
  peekY: number;
  peekRotate: number;
  peekScale: number;
  peekOpacity: number;
  onDismiss: () => void;
}

function ProfileCardItem({
  profile,
  isTop,
  depth,
  peekX,
  peekY,
  peekRotate,
  peekScale,
  peekOpacity,
  onDismiss,
}: ProfileCardItemProps) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      className={styles.card}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 450) {
          onDismiss();
        }
      }}
      whileDrag={{ cursor: 'grabbing' }}
      initial={{ opacity: 0, y: -30, scale: 0.85, rotate: 0 }}
      animate={{
        opacity: peekOpacity,
        x: peekX,
        y: peekY,
        rotate: peekRotate,
        scale: peekScale,
      }}
      exit={{ opacity: 0, x: 240, rotate: 12, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      style={{
        zIndex: 100 - depth,
        pointerEvents: isTop ? 'auto' : 'none',
      }}
      transformTemplate={(_props, generated) =>
        `translateX(-50%) ${generated}`
      }
    >
      {/* Foto destacada — ocupa o topo do card. */}
      <div className={styles.photo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt={profile.name}
          className={styles.photoImg}
          draggable={false}
        />
        {/* Rank badge — agora no estilo gradient-border do botão
         *  "Baixar" do lightbox de fotos exclusivas. Border
         *  transparente com gradient brand brincando atrás. */}
        <span className={styles.rankBadge} aria-label={`Top ${profile.topRank}`}>
          Top {profile.topRank}
        </span>
      </div>

      {/* Info row — nome centralizado com heart toggle à direita
       *  alinhado verticalmente, abaixo da foto. Cidade fica
       *  abaixo, centralizada. */}
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <div className={styles.name}>{profile.name}</div>
          <motion.button
            type="button"
            className={`${styles.heartBtn} ${liked ? styles.heartBtnLiked : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setLiked((v) => !v);
            }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            aria-label={liked ? 'Remover curtida' : 'Curtir perfil'}
            aria-pressed={liked}
          >
            {/* Mesmo coração flat do avatar do usuário no mapa
             *  (Globe.tsx) — viewBox 24×24, stroke 1.8, mesmo path.
             *  Per spec atualizado pra consistência visual com a
             *  paleta de hearts no mapa. */}
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </motion.button>
        </div>
        <div className={styles.city}>{profile.city}</div>
      </div>

      {/* Reactions row — emojis sem círculo, centralizadas. */}
      <div className={styles.reactions} role="group" aria-label="Reações">
        {REACTIONS.map((emoji) => (
          <motion.button
            key={emoji}
            type="button"
            className={`${styles.reaction} ${reaction === emoji ? styles.reactionActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setReaction((r) => (r === emoji ? null : emoji));
            }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.18 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            aria-label={`Reagir com ${emoji}`}
            aria-pressed={reaction === emoji}
          >
            {emoji}
          </motion.button>
        ))}
      </div>

      {/* "Enviar mensagem" — botão de texto full-width pill. */}
      <motion.button
        type="button"
        className={styles.messageBtn}
        onClick={(e) => e.stopPropagation()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      >
        Enviar mensagem
      </motion.button>

      {/* Match suffix — "Vocês curtem Pipoco há mais tempo" etc.
       *  Aparece abaixo do botão, contextualizando a afinidade
       *  no mesmo formato dos cards horizontais. */}
      <div className={styles.matchSuffix}>
        <span className={styles.matchPrefix}>Vocês</span>{' '}
        <span className={styles.matchText}>{profile.matchSuffix}</span>
      </div>
    </motion.div>
  );
}
