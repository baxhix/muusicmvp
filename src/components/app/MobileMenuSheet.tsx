'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  motion,
  useReducedMotion,
  type Variants,
} from 'motion/react';
import { useAuth } from '@/lib/auth/AuthContext';
import RankMedallion from './RankMedallion';
import { useRankBands } from './RankBandsProvider';
import { useAppShell } from '@/lib/app/AppShellContext';
import { setMapVisibility, mapVisibilityErrorMessage } from '@/lib/location/mapVisibility';
import { showAppToast } from './AppToast';
import { track } from '@/lib/analytics';
import MotionSwitch from './MotionSwitch';
import styles from './MobileMenuSheet.module.css';

/**
 * MobileMenuSheet — menu hambúrguer premium do mobile.
 *
 * Refator completo da experiência de abertura inspirado em Floating
 * Action Menu / iOS: o painel sobe da base da tela com spring, os
 * itens entram em stagger (de baixo pra cima, perto do polegar), o
 * backdrop borra o resto do app. Fecha por: tap no backdrop, botão
 * X (FAB inferior direito), swipe pra baixo, Esc ou troca de rota
 * (o pai zera `open` no pathname change). Todas as saídas usam a
 * mesma animação reversa (itens somem antes do painel descer).
 *
 * Fica ABAIXO da navbar (z:245) de propósito — a navbar principal
 * continua visível e interativa durante toda a interação, e o
 * próprio hambúrguer fecha o menu (toggle).
 *
 * Tipografia Borscha grande; itens SEM ícones (exceto a foto de
 * perfil em "Minha conta" e o toggle de visibilidade no mapa).
 */

const STORE_URL =
  'https://lojaanacastela.com.br/?srsltid=AfmBOoqO3lURzf9V03K4wnnoPrXa2sFOUu2r7DE9TJguEVZbdzGrWpka';

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { rankOf } = useRankBands();
  const { setShowPlaylist } = useAppShell();
  const reduce = useReducedMotion();

  /* SSR-safe: createPortal só no client. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Visibilidade no mapa = consentimento LGPD real (location_consent).
   * Update otimista + PATCH; rollback no erro. Menores nunca
   * compartilham (toggle desabilitado). */
  const isMinor = Boolean(user?.isMinor);
  const [consent, setConsent] = useState(Boolean(user?.locationConsent));
  const [consentBusy, setConsentBusy] = useState(false);
  useEffect(() => {
    setConsent(Boolean(user?.locationConsent));
  }, [user?.locationConsent]);

  async function toggleConsent(next: boolean) {
    if (consentBusy || isMinor) return;
    setConsent(next); // otimista
    setConsentBusy(true);
    try {
      // Liga o flag na hora; só captura a geoloc (prompt) se ainda não
      // houver coords — quem já compartilhou alterna instantâneo.
      const hasCoords = user?.lat != null && user?.lng != null;
      const res = await setMapVisibility(next, { hasCoords });
      if (!res.ok) {
        setConsent(!next); // falha de rede → reverte
        return;
      }
      // Ligou mas sem coords (geoloc negada/falhou): mantém ON e avisa.
      if (next && res.needsLocation && res.reason) {
        showAppToast({ message: mapVisibilityErrorMessage(res.reason), tone: 'error' });
      }
      if (next) track('location_consent_granted', { surface: 'settings' });
      else track('location_consent_revoked', {});
      await refresh();
    } catch {
      setConsent(!next);
    } finally {
      setConsentBusy(false);
    }
  }

  /* Esc fecha. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const avatar = user?.avatarUrl ?? '/avatar-placeholder.svg';

  const dispatch = (name: string) => {
    try {
      window.dispatchEvent(new CustomEvent(name));
    } catch {
      /* SSR — ignore */
    }
  };

  /* Swipe-pra-baixo simples (sem drag-follow nem elástico): guarda o Y
   * inicial do toque e, se o dedo desce além do limiar, fecha — só
   * dispara a transição de saída normal. Taps (dy ≈ 0) não fecham. */
  const swipeStartY = useRef<number | null>(null);

  /* ── Variants ──────────────────────────────────────────────
   * Painel: SÓ fade de opacity (sem translate). Antes subia da base
   * com `y: 100% → 0`, mas agora o painel carrega backdrop-filter
   * (blur do drawer) e backdrop-filter + transform faz o iOS
   * re-amostrar o blur por frame → "pisca/treme". Sem translate no
   * painel, o blur é estável; o "subir" continua pelo stagger dos
   * itens (cada um entra com y:26 → 0, de baixo pra cima). */
  const panelVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: reduce
        ? { duration: 0.16 }
        : {
            duration: 0.22,
            ease: 'easeOut',
            when: 'beforeChildren',
            delayChildren: 0.04,
            staggerChildren: 0.032,
            staggerDirection: -1,
          },
    },
  };

  const itemVariants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 26 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 620, damping: 30 },
    },
  };

  const tap = reduce ? undefined : { scale: 0.95 };

  if (!mounted) return null;

  /* Sem AnimatePresence: o menu ABRE com animação (initial → animate),
   * mas FECHA instantâneo — desmonta na hora quando `open` vira false,
   * sem animação de saída (per feedback "retire totalmente os efeitos
   * de fechar o menu"). */
  return createPortal(
    open ? (
      <>
        <motion.div
          className={styles.backdrop}
          aria-hidden="true"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />

          <motion.div
            className={styles.panel}
            role="menu"
            aria-label="Menu"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            onTouchStart={(e) => {
              swipeStartY.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const start = swipeStartY.current;
              swipeStartY.current = null;
              if (start != null && (e.changedTouches[0]?.clientY ?? start) - start > 60) {
                onClose();
              }
            }}
          >
            <span className={styles.grabber} aria-hidden="true" />

            <div className={styles.list}>
              {/* 1. Loja */}
              <motion.a
                variants={itemVariants}
                whileTap={tap}
                role="menuitem"
                className={styles.item}
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                Loja
              </motion.a>

              {/* 2. Playlist */}
              <motion.button
                variants={itemVariants}
                whileTap={tap}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  onClose();
                  setShowPlaylist(true);
                }}
              >
                Playlist
              </motion.button>

              {/* 3. Fanpoints */}
              <motion.button
                variants={itemVariants}
                whileTap={tap}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  onClose();
                  dispatch('app:open-fanpoints');
                }}
              >
                Fanpoints
              </motion.button>

              {/* 4. Convites */}
              <motion.button
                variants={itemVariants}
                whileTap={tap}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  onClose();
                  dispatch('app:open-invite');
                }}
              >
                Convites
              </motion.button>

              {/* 5. Comunidades */}
              <motion.button
                variants={itemVariants}
                whileTap={tap}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  onClose();
                  router.push('/app/comunidades');
                }}
              >
                Comunidades
              </motion.button>

              {/* 6. Minha conta — abre o drawer da conta (TopBar) onde
                  vivem Editar perfil, legal e Sair. Foto de perfil à
                  esquerda do texto. */}
              <motion.button
                variants={itemVariants}
                whileTap={tap}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  onClose();
                  dispatch('app:open-account-drawer');
                }}
              >
                Minha conta
              </motion.button>

              {/* 7. Visível / Invisível no mapa — toggle integrado
                  (location_consent). Linha não-botão pra não aninhar
                  com o switch (que é o controle interativo). */}
              <motion.div
                variants={itemVariants}
                className={`${styles.item} ${styles.itemToggle}`}
              >
                <span className={styles.toggleLead}>
                  <span className={styles.accountAvatarWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar} alt="" className={styles.accountAvatar} />
                    <RankMedallion position={rankOf(user?.id)} size="sm" />
                    {/* Dot de status — verde quando visível no mapa
                        (consent ON), cinza quando invisível. */}
                    <span
                      className={`${styles.accountDot} ${consent ? styles.accountDotOn : ''}`}
                      aria-hidden="true"
                    />
                  </span>
                  <span className={styles.toggleText}>
                    <span className={styles.toggleLabel}>
                      {consent ? 'Visível no mapa' : 'Invisível no mapa'}
                    </span>
                    {/* Legenda pequena (Inter) abaixo do toggle. */}
                    <span className={styles.toggleCaption}>
                      {consent
                        ? 'Não é sua localização exata.'
                        : 'você não está aparecendo no mapa.'}
                    </span>
                  </span>
                </span>
                <MotionSwitch
                  checked={consent}
                  onCheckedChange={toggleConsent}
                  disabled={isMinor || consentBusy}
                  ariaLabel="Visibilidade no mapa"
                />
              </motion.div>
            </div>

            {/* Botão fechar — X no canto superior direito do painel
             *  (absoluto, não rouba espaço vertical dos itens). Fecha o
             *  menu. Antes a classe existia mas o botão sumiu do JSX. */}
            <button
              type="button"
              className={styles.closeFab}
              onClick={onClose}
              aria-label="Fechar menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

          </motion.div>
        </>
      ) : null,
    document.body,
  );
}
