'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import { loadOnboarding, saveOnboarding } from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';
import styles from './interests.module.css';

/**
 * Step 5 — Interests. Grid de categorias/artistas pra
 * personalização do feed inicial. Per spec: melhora retenção,
 * personalização, conexão emocional.
 *
 * UX: chips selecionáveis. Mínimo 3 pra continuar (encoraja
 * engagement). Toggle on/off. Sem categorias hierárquicas —
 * tudo no mesmo nível pra simplicidade.
 */

const INTERESTS: ReadonlyArray<{ id: string; label: string; emoji: string }> = [
  { id: 'sertanejo', label: 'Sertanejo', emoji: '🤠' },
  { id: 'pop', label: 'Pop', emoji: '✨' },
  { id: 'funk', label: 'Funk', emoji: '🔥' },
  { id: 'rap', label: 'Rap', emoji: '🎤' },
  { id: 'rock', label: 'Rock', emoji: '🎸' },
  { id: 'eletronica', label: 'Eletrônica', emoji: '🎧' },
  { id: 'indie', label: 'Indie', emoji: '🌙' },
  { id: 'kpop', label: 'K-Pop', emoji: '💜' },
  { id: 'mpb', label: 'MPB', emoji: '🎶' },
  { id: 'reggae', label: 'Reggae', emoji: '🌴' },
  { id: 'gospel', label: 'Gospel', emoji: '🙏' },
  { id: 'samba', label: 'Samba', emoji: '🥁' },
  { id: 'rb', label: 'R&B', emoji: '💫' },
  { id: 'jazz', label: 'Jazz', emoji: '🎷' },
  { id: 'classica', label: 'Clássica', emoji: '🎻' },
  { id: 'forro', label: 'Forró', emoji: '🪗' },
];

const MIN_INTERESTS = 3;

export default function InterestsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    const stored = loadOnboarding();
    if (!stored.displayName) {
      router.replace('/auth/onboarding/profile');
      return;
    }
    if (stored.interests?.length) setSelected(new Set(stored.interests));
  }, [user, authLoading, router]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    if (selected.size < MIN_INTERESTS || submitting) return;
    setSubmitting(true);
    const interests = Array.from(selected);
    track('interests_submitted', { count: interests.length });
    saveOnboarding({ interests, step: 'success' });
    router.push('/auth/success');
  };

  return (
    <AuthShell back="/auth/onboarding/profile" progress={5 / 6}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className={fields.heading}>O que você curte ouvir?</h1>
        <p className={fields.subtitle}>
          Escolha pelo menos {MIN_INTERESTS}. Vamos usar isso pra montar seu
          feed inicial.
        </p>

        <div className={styles.grid} role="group" aria-label="Interesses">
          {INTERESTS.map((interest) => {
            const isSelected = selected.has(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                onClick={() => toggle(interest.id)}
                className={`${styles.chip} ${isSelected ? styles.chipActive : ''}`}
                aria-pressed={isSelected}
              >
                <span className={styles.chipEmoji}>{interest.emoji}</span>
                {interest.label}
              </button>
            );
          })}
        </div>

        <div className={styles.actionRow}>
          <p className={styles.counter}>
            {selected.size} / {MIN_INTERESTS}+ selecionado{selected.size === 1 ? '' : 's'}
          </p>

          <button
            type="button"
            onClick={handleContinue}
            className={fields.btn}
            disabled={selected.size < MIN_INTERESTS || submitting}
          >
            {submitting ? 'Salvando…' : 'Continuar'}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
