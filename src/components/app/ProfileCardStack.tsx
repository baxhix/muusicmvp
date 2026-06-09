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
}

/* 5 perfis mocados — mix de top 10/20/50 pra mostrar variação
 *  do badge. Avatares via pravatar pra ter fotos realistas. */
const MOCK_PROFILES: ProfileCard[] = [
  {
    id: 'p1',
    name: 'Helena Bastos',
    city: 'Recife',
    country: 'Brasil',
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
    topRank: 10,
  },
  {
    id: 'p2',
    name: 'Rafael Tavares',
    city: 'Lisboa',
    country: 'Portugal',
    avatarUrl: 'https://i.pravatar.cc/300?img=33',
    topRank: 50,
  },
  {
    id: 'p3',
    name: 'Cecília Pessoa',
    city: 'Curitiba',
    country: 'Brasil',
    avatarUrl: 'https://i.pravatar.cc/300?img=44',
    topRank: 20,
  },
  {
    id: 'p4',
    name: 'Augusto Tafur',
    city: 'Asunción',
    country: 'Paraguai',
    avatarUrl: 'https://i.pravatar.cc/300?img=12',
    topRank: 50,
  },
  {
    id: 'p5',
    name: 'Vitória Camargo',
    city: 'Goiânia',
    country: 'Brasil',
    avatarUrl: 'https://i.pravatar.cc/300?img=56',
    topRank: 10,
  },
];

/* Reações disponíveis no card. Per spec atualizado o 🔥 foi
 *  substituído por 👀 (olhos) — sinaliza "estou observando" /
 *  curioso, mais alinhado com o tom do app. */
const REACTIONS = ['👀', '❤️', '👏'];

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
        <span className={styles.rankBadge} aria-label={`Top ${profile.topRank}`}>
          Top {profile.topRank}
        </span>
      </div>

      {/* Info — nome + cidade CENTRALIZADOS per spec. */}
      <div className={styles.info}>
        <div className={styles.name}>{profile.name}</div>
        <div className={styles.city}>{profile.city}</div>
      </div>

      {/* Reactions row — emojis sem círculo, centralizadas
       *  (justify-content: center) per spec. */}
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

      {/* "Enviar mensagem" — botão de texto full-width pill,
       *  mesmo estilo do "Ver mais" do Box Fanverse Ana Castela
       *  (.viewMore em MaterialsTabContent: bg sutil, color
       *  branco-translúcido, hover mais escuro). */}
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
    </motion.div>
  );
}
