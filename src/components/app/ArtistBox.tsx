'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { BENEFITS, BenefitIcon } from './SuperfansPanel';
import {
  type DailyMissionId,
  useDailyMissions,
} from '@/hooks/useDailyMissions';
import styles from './ArtistBox.module.css';

// Loja da Boiadeira — official Ana Castela store. Same URL the
// TopBar drawer points to, duplicated here so the ArtistBox stays
// a self-contained module (importing TopBar internals would couple
// the two surfaces unnecessarily).
const STORE_URL =
  'https://lojaanacastela.com.br/?srsltid=AfmBOoqO3lURzf9V03K4wnnoPrXa2sFOUu2r7DE9TJguEVZbdzGrWpka';

/**
 * Per-mission display metadata. Stays client-side because there's no
 * reason for the server to ship icons + Portuguese copy on every
 * /api/me/missions call. The server returns just { id, progress,
 * target, done }; we stitch the rest here.
 *
 * `xp` is the reward awarded once the mission is complete — same
 * semantics as the old mock, but now stitched by id.
 */
interface MissionMeta {
  id: DailyMissionId;
  icon: string;
  name: string;
  xp: string;
}

const MISSION_META: MissionMeta[] = [
  { id: 'listen_5',     icon: '🎵', name: 'Ouça 5 músicas hoje',     xp: '+50 FP'  },
  { id: 'like_track',   icon: '❤️', name: 'Curtir uma música',        xp: '+30 FP'  },
  { id: 'start_chat',   icon: '💬', name: 'Inicie uma conversa',      xp: '+40 FP'  },
  { id: 'daily_login',  icon: '🔥', name: 'Login diário',              xp: '+120 FP' },
  /* +2 missões per product feedback "deixe 6 missões no total". */
  { id: 'share_song',   icon: '🔗', name: 'Compartilhe uma música',   xp: '+25 FP'  },
  { id: 'follow_artist', icon: '⭐', name: 'Siga um artista',         xp: '+35 FP'  },
];

const TOTAL = MISSION_META.length;

/** Sum of XP across only the missions currently completed. */
function sumEarnedXp(
  meta: MissionMeta[],
  doneById: Record<string, boolean>,
): number {
  return meta
    .filter((m) => doneById[m.id])
    .reduce(
      (acc, m) => acc + parseInt(m.xp.replace(/\D/g, ''), 10),
      0,
    );
}

export default function ArtistBox() {
  // Default to OPEN on desktop so the box still reads as the
  // permanently-visible "Fanverse card" it always was — but the
  // toggle now genuinely flips the dropdown closed (see the
  // updated CSS below: the desktop `max-height: none` override
  // is gone, so the .boxOpen / max-height transition runs on
  // every viewport).
  //
  // On mobile the box is `display: none` entirely (per the
  // existing @media block), so this initial value is a no-op
  // there.
  const [open, setOpen] = useState(true);

  /* Tab ativa no corpo do box, per product feedback "no lugar do
   * badge 15% OFF, adicionar três tabs: Missões, Ranking, Meus
   * benefícios". Tab bar segue o mesmo padrão visual do
   * SuperfansPanel (.tabs/.tab/.tabActive). Default: 'missoes' —
   * preserva o comportamento atual de mostrar a lista de missões
   * + progresso. Outras tabs mostram placeholder "Em breve"
   * (implementação completa fica pro próximo round). */
  type BoxTab = 'missoes' | 'ranking' | 'beneficios';
  const [activeTab, setActiveTab] = useState<BoxTab>('missoes');

  /* Modal "Convide seus amigos" — 4 códigos copiáveis. Triggered
   * pelo botão pill "4 convites" ao lado de 402.299 Fanpoints
   * no header do box. Per product feedback. */
  const [inviteOpen, setInviteOpen] = useState(false);
  // contentRef is retained because the inner missions list still
  // references it via ref (legacy — kept so the layout doesn't
  // collapse to 0 if the missions container is queried for
  // scrollHeight by any future feature like auto-scroll).
  const contentRef = useRef<HTMLDivElement>(null);

  // Logged-in user's current Fanpoints balance — fetched live via
  // useUserProfile so it stays accurate when the user earns/spends
  // FP elsewhere.
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  // Live daily-mission progress from the platform's real activity
  // (listening_history, track_likes, user_activities). Polled every
  // 60s + on demand via refresh().
  const { missions } = useDailyMissions();

  // Map "id → done" for the metadata renderer below.
  const doneById = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (missions) for (const m of missions) map[m.id] = m.done;
    return map;
  }, [missions]);

  const completed = MISSION_META.filter((m) => doneById[m.id]).length;
  const progress  = Math.round((completed / TOTAL) * 100);
  const fpEarned  = sumEarnedXp(MISSION_META, doneById);

  // ── Per-mission completion celebration ──
  //
  // Per product feedback "Ao concluir cada tarefa, adicione as
  // animações festivas dentro do box" — every time a mission
  // transitions from open → done, the box pops a brief sparkle
  // burst inside the row + a row glow pulse. Multiple
  // completions can overlap; each id gets a 1.6s timer that
  // peels it back out of the `celebratingIds` set when the
  // animation finishes.
  //
  // The previous done-state-by-mission lives in `prevDoneByIdRef`
  // so the effect only celebrates the TRANSITION, not the
  // steady "this mission is already done" state visible on
  // every render after the user reloads the page.
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const prevDoneByIdRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!missions || missions.length === 0) return;
    const prev = prevDoneByIdRef.current;
    if (prev === null) {
      // First population — record the baseline without
      // celebrating anything. Otherwise reloading the app on a
      // 5/5 day would spray confetti for every mission.
      prevDoneByIdRef.current = doneById;
      return;
    }
    const newlyDone: string[] = [];
    for (const m of missions) {
      if (m.done && !prev[m.id]) newlyDone.push(m.id);
    }
    if (newlyDone.length === 0) {
      prevDoneByIdRef.current = doneById;
      return;
    }
    setCelebratingIds((curr) => {
      const next = new Set(curr);
      for (const id of newlyDone) next.add(id);
      return next;
    });
    const timeouts = newlyDone.map((id) =>
      window.setTimeout(() => {
        setCelebratingIds((curr) => {
          const next = new Set(curr);
          next.delete(id);
          return next;
        });
      }, 1600),
    );
    prevDoneByIdRef.current = doneById;
    return () => {
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [missions, doneById]);

  // ── Pulse the chevron when the user earns Fanpoints ──
  //
  // The `app:points-awarded` CustomEvent fires anywhere
  // `awardPoints()` runs (likes, comments, sends, chat starts,
  // every-3-streams). The PointsToast hooks the same event to
  // surface a "+10 FP" toast; we add a complementary affordance
  // here — a brief glow on the chevron — so the user knows where
  // the new total went, even if they missed the toast. ~1.5s,
  // then auto-cleared so the pulse is single-shot, not nagging.
  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onAwarded = () => {
      setPulsing(true);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setPulsing(false), 1500);
    };
    window.addEventListener('app:points-awarded', onAwarded);
    return () => {
      window.removeEventListener('app:points-awarded', onAwarded);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  return (
    <div className={`${styles.box} ${open ? styles.boxOpen : ''}`}>

      {/* Compact header pill — always visible. Pinned to the
       *  top-left so it shares the same horizontal axis as the
       *  TopBar avatar on the right. Click anywhere on it to
       *  toggle the dropdown below. */}
      <button
        type="button"
        className={`${styles.compactBar} ${pulsing ? styles.compactBarPulsing : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Fechar Fanverse' : 'Abrir Fanverse'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ana-castela-box.jpg"
          alt=""
          className={styles.compactPhoto}
        />
        <span className={styles.compactName}>Ana Castela</span>
        <span className={styles.compactFanpoints}>
          {/* Crown icon — Fanverse points indicator. Was a 5-point
           *  star; product feedback wanted a crown to align with
           *  the "Superfã" identity. The peaks-to-baseline path
           *  reads as a crown at any size from 12-24px. */}
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
          </svg>
          {fanpoints.toLocaleString('pt-BR')}
        </span>
        <svg
          className={`${styles.compactChevron} ${open ? styles.compactChevronOpen : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>

      {/* Artist header + discount badge — both ALWAYS visible
       *  per product feedback "A versão retraída do box
       *  Fanverse Ana Castela deve ser até o fim do badge de
       *  15% off e não ficar apenas uma linha". Previously
       *  these lived INSIDE `.dropdown` so they collapsed
       *  alongside the missions list; now they're siblings of
       *  `.dropdown` (and of the `.compactBar` pill that's
       *  desktop-hidden), guaranteeing the collapsed view
       *  always shows photo + name + Fanpoints + the discount
       *  pill before any toggle. */}
      {/* Header AGORA é o toggle do dropdown — per product feedback
       *  "remova a seta do lado esquerdo do box para ter mais espaço
       *  para as tabs. Deixe o comportamento de expandir ao clicar
       *  na imagem da Ana Castela/nome". O chevron `.headerToggle`
       *  que vivia em `.discountRow` foi removido — `.discountRow`
       *  agora só hospeda o tab bar. */}
      <button
        type="button"
        className={`${styles.header} ${styles.headerBtn}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Fechar Fanverse' : 'Abrir Fanverse'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ana-castela-box.jpg" alt="Ana Castela" className={styles.photo} />
        <div className={styles.info}>
          <div className={styles.nameLine}>
            <span className={styles.label}>Fanverse</span>
            <span className={styles.name}>Ana Castela</span>
          </div>
          {/* Fanpoints sits IMMEDIATELY below the name per product
              feedback "deixe o número de fanpoints logo abaixo do
              nome". The earlier bottom-alignment (justify-content:
              space-between on `.info`) was retired — the row now
              flows naturally under the name with a tight gap. */}
          {/* Crown icon removido per product feedback "remova o
           * ícone de coroa ao lado dos Fanpoints". Só valor + label.
           * `align-items: baseline` no container alinha 402.299 +
           * Fanpoints pela mesma linha de base, mesmo com font-sizes
           * diferentes. Botão "4 convites" à direita per product
           * feedback "à frente de 402.299 Fanpoints adicione um
           * botão totalmente arredondado, preto com a borda
           * gradiente roxa, ao clicar abre um modal com 4 códigos". */}
          <div className={styles.fanpointsInline}>
            <span className={styles.fanpointsInlineValue}>
              {fanpoints.toLocaleString('pt-BR')}
            </span>
            <span className={styles.fanpointsInlineLabel}>Fanpoints</span>
            <span
              role="button"
              tabIndex={0}
              className={styles.invitesBtn}
              onClick={(e) => {
                /* Header inteiro é o trigger do dropdown; aqui paramos
                 * a propagação pra que o clique NO botão de convites
                 * só abra o modal, sem colapsar/expandir o box. */
                e.stopPropagation();
                setInviteOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setInviteOpen(true);
                }
              }}
            >
              4 convites
            </span>
          </div>
        </div>
      </button>

      {/* Discount row — agora hospeda APENAS o tab bar. O chevron
       *  toggle foi removido (header virou o trigger do dropdown)
       *  pra abrir espaço pras 3 tabs sem aperto. */}
      <div className={styles.discountRow}>
        {/* Tab bar — substitui o antigo badge "15% OFF Ativado na
         * Loja da Boiadeira" per product feedback. Mesmo padrão
         * visual do SuperfansPanel (segmented control inset com
         * .tabs/.tab/.tabActive). Switch do conteúdo do dropdown
         * acontece abaixo, no body. */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'missoes'}
            className={`${styles.tab} ${activeTab === 'missoes' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('missoes'); if (!open) setOpen(true); }}
          >
            Missões
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ranking'}
            className={`${styles.tab} ${activeTab === 'ranking' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('ranking'); if (!open) setOpen(true); }}
          >
            Ranking
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'beneficios'}
            className={`${styles.tab} ${activeTab === 'beneficios' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('beneficios'); if (!open) setOpen(true); }}
          >
            Conquistas
          </button>
        </div>
      </div>

      {/* Affordance "expandir" — visível APENAS quando o box está
       *  fechado, per product feedback "com o box fechado, aumente
       *  um pouco a altura para inserir a seta para baixo e
       *  indicar que ao clicar o box se expande". Faixa fina com
       *  chevron pulsante apontando pra baixo; clique expande. Some
       *  quando abre porque o footer da dropdown já carrega o
       *  chevron oposto (apontando pra cima → fechar). */}
      {!open && (
        <button
          type="button"
          className={styles.expandHint}
          onClick={() => setOpen(true)}
          aria-label="Expandir Fanverse"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
      )}

      {/* Drop-down body — collapsed by default, animates open via
       *  the .boxOpen modifier on the wrapper above. Now hosts
       *  ONLY the missions list + progress + footer. The artist
       *  header + discount badge moved above this wrapper so
       *  they stay visible in the collapsed state. */}
      <div className={styles.dropdown}>

      {/* Missions list — the dropdown wrapper above already
       *  collapses/expands the whole body, so we don't need the
       *  inner maxHeight clipper anymore. Mission rows are always
       *  laid out when the dropdown is open. */}
      <div className={styles.content}>
        <div ref={contentRef}>
          <div className={styles.divider} />
          {/* Body switch por tab. */}
          {activeTab === 'ranking' && <RankingTabContent />}
          {activeTab === 'beneficios' && <BenefitsTabContent />}
          {activeTab === 'missoes' && (
          <div className={styles.missionsList}>
            {MISSION_META.map((m) => {
              const isDone = doneById[m.id] ?? false;
              const isCelebrating = celebratingIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`${styles.mission} ${isDone ? styles.missionDone : ''} ${isCelebrating ? styles.missionJustDone : ''}`}
                >
                  <span className={styles.missionIcon}>{m.icon}</span>
                  <div className={styles.missionText}>
                    <span className={styles.missionName}>{m.name}</span>
                  </div>
                  <span className={styles.missionXp}>{m.xp}</span>
                  <div className={styles.missionCheck}>
                    <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 4l2 2 3-3.5"/>
                    </svg>
                  </div>
                  {/* Sparkle burst overlay — appears for ~1.6s
                      after a mission transitions to done. 5
                      small particles scatter horizontally with
                      different rise + fade timings so the burst
                      reads as organic festivity rather than a
                      static graphic. See `.missionSparkles` +
                      `.sparkle` in the module CSS. */}
                  {isCelebrating && (
                    <div className={styles.missionSparkles} aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={styles.sparkle}
                          style={
                            {
                              ['--sp-x' as string]: `${(i - 2) * 14}px`,
                              ['--sp-delay' as string]: `${i * 60}ms`,
                            } as React.CSSProperties
                          }
                        >
                          <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" />
                          </svg>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {/* Progress bar — só na tab Missões (mede missões do dia). */}
      {activeTab === 'missoes' && (
      <div className={styles.progressWrap}>
        <div className={styles.progressLabel}>
          <span className={styles.progressText}>{completed}/{TOTAL} missões</span>
          <span className={styles.progressText}>{progress}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
      )}

      {/* Dropdown footer — closes the dropdown (toggle). */}
      <div className={styles.footer} onClick={() => setOpen(o => !o)}>
        <div className={styles.footerRow}>
          <span className={styles.missionsTitle}>
            Missões do Dia
            {/* Info character com tooltip CSS custom per product
             * feedback "inclua um caracter de Info na palavra
             * Missões do dia com um tooltip personalizado". O
             * conteúdo do tooltip vive na pseudo-class via
             * data-tooltip pra ficar acessível ao CSS hover. */}
            <span
              className={styles.missionsInfo}
              data-tooltip="Cada dia uma missão diferente. Aproveite!"
              role="img"
              aria-label="Cada dia uma missão diferente. Aproveite!"
              onClick={(e) => {
                /* O footer inteiro toggle a dropdown — paramos
                 * a propagação no info pra que tooltip mobile
                 * (tap) não cause toggle indesejado. */
                e.stopPropagation();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
          </span>
          <span className={styles.xpTotal}>{fpEarned} Fanpoints</span>
        </div>
        <div className={styles.footerArrow}>
          <svg
            className={`${styles.footerChevron} ${open ? styles.footerChevronOpen : ''}`}
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M5 9l7 7 7-7"/>
          </svg>
        </div>
      </div>

      </div>  {/* /dropdown */}

      {/* Modal "Convide seus amigos" — render fora do dropdown
       *  (mesmo tree do .box, mas overlay full-viewport via
       *  position:fixed no CSS). Renderiza condicionalmente. */}
      {inviteOpen && (
        <InviteFriendsModal onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Modal "Convide seus amigos" — 4 códigos pre-gerados com
 * botão "Copiar" por linha. Per product feedback "ao clicar,
 * abre um modal com 4 códigos, botão de copiar. Título do
 * modal: Convide seus amigos". Click no backdrop ou na X fecha.
 * ──────────────────────────────────────────────────────────── */
const INVITE_CODES = [
  'FANV-9K2X4',
  'FANV-MT7Q8',
  'FANV-B5RP3',
  'FANV-YH6JD',
];

function InviteFriendsModal({ onClose }: { onClose: () => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ESC fecha o modal. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Cleanup do timer ao desmontar pra não disparar setState
   * num componente já fora da tree. */
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function handleCopy(code: string, idx: number) {
    /* navigator.clipboard pode falhar em contexts não-secure;
     * fallback via execCommand. */
    const onDone = () => {
      setCopiedIdx(idx);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedIdx(null), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(onDone).catch(() => {
        // fallback silencioso
        onDone();
      });
    } else {
      onDone();
    }
  }

  return (
    <div
      className={styles.inviteBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Convide seus amigos"
    >
      <div
        className={styles.inviteModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inviteHeader}>
          <h3 className={styles.inviteTitle}>Convide seus amigos.</h3>
          <button
            type="button"
            className={styles.inviteClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className={styles.inviteSubtitle}>
          Compartilhe um dos códigos abaixo. Cada amigo que entrar
          rende Fanpoints pra você.
        </p>
        <div className={styles.inviteList}>
          {INVITE_CODES.map((code, idx) => (
            <div key={code} className={styles.inviteRow}>
              <span className={styles.inviteCode}>{code}</span>
              <button
                type="button"
                className={`${styles.inviteCopyBtn} ${copiedIdx === idx ? styles.inviteCopyBtnDone : ''}`}
                onClick={() => handleCopy(code, idx)}
              >
                {copiedIdx === idx ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Ranking — espelha o conteúdo do SuperfansPanel mas
 * compactado pro footprint do ArtistBox: SEM foto e SEM pontos
 * por linha. Mantém:
 *   - rank
 *   - nome
 *   - cidade
 *   - barra de progresso ("X pontos para entrar no top 10")
 *   - botão "Carregar mais usuários" (top 6 → full)
 * Per product feedback "ranking deve ter o conteúdo do
 * SuperfansPanel ajustado pro box, sem pontuação, sem foto,
 * mantém barra de progresso, deve ter botão carregar mais".
 * ──────────────────────────────────────────────────────────── */
function RankingTabContent() {
  const { user } = useAuth();
  const { ranking, loading, error } = useRanking(true);
  /* Lista de online ao vivo — usada pra renderizar o dot
   * verde/cinza ao lado do avatar de cada linha. Recarrega
   * a cada 30s + on socket `presence:batch`. */
  const { users: liveUsers } = useLiveUsers();
  const onlineIds = useMemo(
    () => new Set(liveUsers.map((u) => u.id)),
    [liveUsers],
  );
  const [showAll, setShowAll] = useState(false);

  /* Threshold pra entrar no top 10 = fanpoints do rank-10. Se a
   * lista tem menos de 10 fãs, threshold é null e o copy muda. */
  const top10Threshold = ranking.length >= 10 ? ranking[9].points : null;
  const myRow = user ? ranking.find((r) => r.userId === user.id) ?? null : null;
  const myPoints = myRow?.points ?? 0;
  const myRank = myRow
    ? ranking.findIndex((r) => r.userId === user!.id) + 1
    : ranking.length + 1;
  const meInTop10 = myRow ? myRank <= 10 : false;
  const pointsToTop10 =
    myRow && top10Threshold !== null
      ? Math.max(0, top10Threshold + 1 - myPoints)
      : 0;
  /* Per product feedback "simule a barra de progresso metade
   * completa": fixamos em 50%. Antes a barra calculava progresso
   * real do user, mas o user pediu mock visual em ½. */
  const meProgressPct = 50;

  const visible = showAll ? ranking : ranking.slice(0, 6);

  return (
    <div className={styles.tabRanking}>
      {/* Per product feedback "deixe o texto Você está no Top 10!
       * ACIMA da barra de progresso" — invertemos a ordem (label
       * primeiro, depois track). */}
      <div className={styles.tabRankingProgress}>
        <div className={styles.tabRankingProgressLabel}>
          {meInTop10
            ? 'Você está no Top 10!'
            : top10Threshold === null
              ? 'Continue ouvindo pra entrar no ranking'
              : `${pointsToTop10.toLocaleString('pt-BR')} pontos para entrar no top 10`}
        </div>
        <div className={styles.tabRankingProgressTrack}>
          <div
            className={styles.tabRankingProgressFill}
            style={{ width: `${meProgressPct}%` }}
          />
        </div>
      </div>

      {/* Lista (sem foto, sem pontos). */}
      {error ? (
        <div className={styles.tabEmpty}>Não consegui carregar agora.</div>
      ) : ranking.length === 0 ? (
        <div className={styles.tabEmpty}>
          {loading ? 'Carregando…' : 'Sem fãs ainda.'}
        </div>
      ) : (
        <div className={styles.tabRankingList}>
          {visible.map((r, idx) => {
            const rank = idx + 1;
            const isMe = r.userId === user?.id;
            const isTop3 = rank <= 3;
            const name = r.name?.trim() || r.email.split('@')[0];
            const avatar = r.avatarUrl ?? '/avatar-placeholder.svg';
            /* Online = presença ao vivo (lista do useLiveUsers).
             * O "Você" sempre conta como online — o backend só
             * inclui o próprio user no payload quando o socket está
             * ativo, mas o usuário lendo o ranking obviamente está
             * online. */
            const isOnline = isMe || onlineIds.has(r.userId);
            return (
              <div
                key={r.userId}
                className={`${styles.tabRankingRow} ${isMe ? styles.tabRankingRowMe : ''} ${isTop3 ? styles.tabRankingRowTop3 : ''}`}
              >
                {/* Per product feedback "sinalize melhor o top 3":
                 * rank usa medal pillorada quando ≤3 (bg dourado/prata/
                 * bronze) em vez de só o emoji solto. */}
                <span className={`${styles.tabRankingRank} ${isTop3 ? styles.tabRankingRankMedal : ''} ${rank === 1 ? styles.tabRankingRankGold : rank === 2 ? styles.tabRankingRankSilver : rank === 3 ? styles.tabRankingRankBronze : ''}`}>
                  {isTop3 ? rank : `#${rank}`}
                </span>
                {/* Avatar wrap — hospeda o dot de online/offline no
                 * canto inferior direito. Mesmo padrão visual dos
                 * avatares do chat (verde sólido + ring preto). */}
                <span className={styles.tabRankingAvatarWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt=""
                    className={styles.tabRankingAvatar}
                  />
                  <span
                    className={`${styles.tabRankingPresence} ${isOnline ? styles.tabRankingPresenceOn : ''}`}
                    aria-label={isOnline ? 'Online' : 'Offline'}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                </span>
                <div className={styles.tabRankingInfo}>
                  {/* Nome agora é Link → /app/u/{id} per product
                   * feedback "o nome do usuário deve ser clicável e
                   * aparecer o perfil de usuário". */}
                  <Link
                    href={`/app/u/${r.userId}`}
                    className={styles.tabRankingName}
                    prefetch={false}
                  >
                    {name}
                  </Link>
                  {/* Per product feedback "inclua a quantidade de
                   * fanpoints de cada usuário antes do nome da
                   * cidade". Fanpoints + cidade na MESMA linha
                   * subtítulo separados por um dot. */}
                  <span className={styles.tabRankingSubline}>
                    <span className={styles.tabRankingPoints}>
                      {r.points.toLocaleString('pt-BR')} FP
                    </span>
                    {r.city && (
                      <>
                        <span className={styles.tabRankingSep} aria-hidden="true">·</span>
                        <span className={styles.tabRankingCity}>{r.city}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showAll && ranking.length > 6 && (
        <button
          type="button"
          className={styles.tabRankingLoadMore}
          onClick={() => setShowAll(true)}
        >
          Carregar mais usuários
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Conquistas — listagem das BENEFITS (reusa SuperfansPanel)
 * com split FIXO por índice em vez de threshold de Fanpoints,
 * per product feedback "nos 4 primeiros itens deixe ativos com
 * cadeado desbloqueado; demais bloqueados com cadeado + o que
 * precisa ser feito abaixo". Linha de descrição truncada em 1
 * linha (`.tabBenefitDesc` usa ellipsis) pra caber mais itens
 * sem aumentar altura.
 * ──────────────────────────────────────────────────────────── */
function BenefitsTabContent() {
  /* Per product feedback iterativo:
   *  - "deixe apenas 3 itens desbloqueados" → slice(0, 3)
   *  - "remova a linha descritiva" → renderiza só title (sem desc)
   *  - "remova a palavra Bloqueadas" → sem section title separador
   *  - "adicione mais 8 itens com scroll" → BENEFITS estendido (6 → 14)
   *
   * Lista única scrollável (.tabBenefitsScroll com overflow-y).
   * Locked usa o copy "Acumule X Fanpoints" como ação a ser feita
   * — única linha embaixo do título. */
  const unlocked = BENEFITS.slice(0, 3);
  const locked = BENEFITS.slice(3);

  return (
    <div className={styles.tabBenefitsScroll}>
      <div className={styles.tabBenefits}>
        {unlocked.map((b) => (
          <div key={b.id} className={styles.tabBenefitRow}>
            <span className={styles.tabBenefitIcon} aria-hidden="true">
              <BenefitIcon kind={b.icon} />
            </span>
            <div className={styles.tabBenefitInfo}>
              <span className={styles.tabBenefitTitle}>{b.title}</span>
            </div>
            <LockIcon variant="unlocked" />
          </div>
        ))}
        {locked.map((b) => (
          <div
            key={b.id}
            className={`${styles.tabBenefitRow} ${styles.tabBenefitRowLocked}`}
          >
            <span className={styles.tabBenefitIcon} aria-hidden="true">
              <BenefitIcon kind={b.icon} />
            </span>
            <div className={styles.tabBenefitInfo}>
              <span className={styles.tabBenefitTitle}>{b.title}</span>
              <span className={styles.tabBenefitDesc}>
                Acumule {b.threshold.toLocaleString('pt-BR')} Fanpoints
              </span>
            </div>
            <LockIcon variant="locked" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Cadeado inline — duas variantes (aberto/fechado). Tamanho
 * 14×14, cor herdada via currentColor pra adaptar ao estado
 * unlocked (rgba branco) ou locked (já com opacity reduzida no
 * row). */
function LockIcon({ variant }: { variant: 'locked' | 'unlocked' }) {
  return (
    <span
      className={`${styles.tabBenefitLock} ${variant === 'unlocked' ? styles.tabBenefitLockOpen : ''}`}
      aria-label={variant === 'unlocked' ? 'Desbloqueado' : 'Bloqueado'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        {variant === 'locked' ? (
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        ) : (
          /* Aro saindo pra direita (cadeado aberto) — mesma origem
           * vertical, mas o lado direito do aro "puxa pra cima
           * e pra fora" indicando o destrancado. */
          <path d="M8 11V8a4 4 0 0 1 7.6-1.8" />
        )}
      </svg>
    </span>
  );
}
