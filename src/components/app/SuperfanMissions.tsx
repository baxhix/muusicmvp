'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './SuperfanMissions.module.css';

const MISSIONS = [
  { id: 1,  icon: '🎵', title: 'Ouça 5 músicas hoje',        desc: 'Explore artistas do seu gosto',       xp: '+50 XP'  },
  { id: 2,  icon: '👥', title: 'Conecte-se com um fã',       desc: 'Encontre alguém com gosto igual',     xp: '+80 XP'  },
  { id: 3,  icon: '🌍', title: 'Explore 3 cidades no mapa',  desc: 'Clique nos avatares do globo',         xp: '+60 XP'  },
  { id: 4,  icon: '💬', title: 'Inicie uma conversa',         desc: 'Mande uma mensagem no chat',           xp: '+40 XP'  },
  { id: 5,  icon: '❤️', title: 'Reaja a um post',            desc: 'Interaja com o feed ao vivo',          xp: '+30 XP'  },
  { id: 6,  icon: '🏆', title: 'Complete seu perfil',         desc: 'Adicione foto e cidade',               xp: '+100 XP' },
  { id: 7,  icon: '🎪', title: 'Entre em uma comunidade',     desc: 'Junte-se a um fã clube',               xp: '+70 XP'  },
  { id: 8,  icon: '🔥', title: 'Sequência de 3 dias',         desc: 'Ouça música 3 dias seguidos',          xp: '+120 XP' },
  { id: 9,  icon: '🎯', title: 'Descubra um novo artista',    desc: 'Ouça alguém que nunca ouviu antes',    xp: '+55 XP'  },
  { id: 10, icon: '⭐', title: 'Vire superfã',                desc: 'Alcance nível 5 de engajamento',       xp: '+200 XP' },
];

interface Card {
  uid: number;
  mission: typeof MISSIONS[0];
  phase: 'in' | 'visible' | 'out';
}

const MAX_CARDS  = 3;
const INTERVAL   = 4200;
const ANIM_MS    = 420;

export default function SuperfanMissions() {
  const [cards, setCards]   = useState<Card[]>([]);
  const uidRef              = useRef(0);
  const missionIdxRef       = useRef(0);

  useEffect(() => {
    const addCard = () => {
      const mission = MISSIONS[missionIdxRef.current % MISSIONS.length];
      missionIdxRef.current++;
      const uid = ++uidRef.current;

      setCards(prev => {
        const newCard: Card = { uid, mission, phase: 'in' };
        let next = [...prev, newCard];
        // Mark oldest for exit when over limit
        if (next.length > MAX_CARDS) {
          next = next.map((c, i) => i === 0 ? { ...c, phase: 'out' as const } : c);
        }
        return next;
      });

      // in → visible + remove exited cards in one pass
      setTimeout(() => {
        setCards(prev =>
          prev
            .filter(c => c.phase !== 'out')
            .map(c => c.uid === uid ? { ...c, phase: 'visible' as const } : c)
        );
      }, ANIM_MS);
    };

    const initial = setTimeout(addCard, 900);
    const interval = setInterval(addCard, INTERVAL);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  if (cards.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.heading}>Missões do Superfã</span>
      <div className={styles.stack}>
        {cards.map(card => (
          <div
            key={card.uid}
            className={`${styles.card} ${styles[card.phase]}`}
          >
            <div className={styles.iconWrap}>
              <span className={styles.icon}>{card.mission.icon}</span>
            </div>
            <div className={styles.info}>
              <span className={styles.title}>{card.mission.title}</span>
              <span className={styles.desc}>{card.mission.desc}</span>
            </div>
            <span className={styles.xp}>{card.mission.xp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
