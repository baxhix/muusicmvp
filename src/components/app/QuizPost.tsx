'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import VerifiedBadge from './VerifiedBadge';
import styles from './QuizPost.module.css';

/* ── Types ─────────────────────────────────────────────────
 * Multiple-choice quiz post — one question, four options, one of
 * which is the correct answer. After "Resolver" the card shows the
 * correct option and (only on correct picks) dispatches the
 * `app:feed-celebrate` event so the FeedPanel can fire its
 * confetti-style overlay scoped to the feed envelope.
 */
export interface QuizOptionData {
  id: string;
  label: string;
}

export interface QuizPostData {
  user: string;
  avatar: string;
  time: string;
  /** The question shown above the options. */
  question: string;
  /** Exactly four options. Order matters — keep the correct option
   *  in `correctId` so we don't tip the right answer off via index. */
  options: [QuizOptionData, QuizOptionData, QuizOptionData, QuizOptionData];
  correctId: string;
  /** Optional Fanpoints reward — surfaced in the celebration text. */
  reward?: number;
}

export default function QuizPost({ data }: { data: QuizPostData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  const isCorrect = solved && selected === data.correctId;

  const handleSolve = () => {
    if (!selected || solved) return;
    setSolved(true);
    const correct = selected === data.correctId;
    track('feed_quiz_solved', {
      quiz_question: data.question,
      picked_id: selected,
      correct,
    });
    if (correct && typeof window !== 'undefined') {
      // The FeedPanel listens for this and shows a scoped
      // celebration overlay (motion/react confetti via
      // MotionConfetti global + congrats headline) — same vibe
      // as AchievementCelebration. O confetti em si só dispara
      // se `detail.points` for múltiplo de 500k (quiz não passa
      // points por default, então só headline aparece).
      window.dispatchEvent(
        new CustomEvent('app:feed-celebrate', {
          detail: {
            headline: 'Você acertou!',
            sub: data.reward
              ? `+${data.reward.toLocaleString('pt-BR')} Fanpoints`
              : 'Parabéns!',
          },
        }),
      );
    }
  };

  return (
    <div className={`${styles.card} ${isCorrect ? styles.cardWin : ''}`}>
      {/* Header — same envelope as MediaPost / PollPost. */}
      <div className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.avatar} alt={data.user} className={styles.avatar} />
        <div className={styles.meta}>
          <div className={styles.name}>
            {data.user}
            <VerifiedBadge size={13} className={styles.verifiedBadge} />
          </div>
          <div className={styles.time}>{data.time}</div>
        </div>
      </div>

      {/* Question */}
      <p className={styles.question}>{data.question}</p>

      {/* Options — flat list, one per row. Disabled after solving so
          the user can't bounce around the correct/incorrect states. */}
      <div className={styles.options}>
        {data.options.map((opt) => {
          const isPicked = selected === opt.id;
          const isAnswer = opt.id === data.correctId;
          // Color rules:
          //  - Before solving: picked = highlighted, others = neutral.
          //  - After solving:
          //      correct answer always green.
          //      picked + correct → already green.
          //      picked + wrong   → red.
          let stateClass = '';
          if (!solved && isPicked) stateClass = styles.optionPicked;
          if (solved && isAnswer) stateClass = styles.optionCorrect;
          if (solved && isPicked && !isAnswer) stateClass = styles.optionWrong;

          return (
            <button
              key={opt.id}
              type="button"
              className={`${styles.option} ${stateClass}`}
              onClick={() => {
                if (solved) return;
                setSelected(opt.id);
              }}
              disabled={solved}
              aria-pressed={isPicked}
            >
              <span className={styles.bullet} aria-hidden="true" />
              <span className={styles.optionLabel}>{opt.label}</span>
              {solved && isAnswer && (
                <svg
                  className={styles.checkIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5 9-11" />
                </svg>
              )}
              {solved && isPicked && !isAnswer && (
                <svg
                  className={styles.checkIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer — "Resolver" CTA before solving; result message after. */}
      <div className={styles.footer}>
        {!solved && (
          <button
            type="button"
            className={styles.solveBtn}
            onClick={handleSolve}
            disabled={!selected}
          >
            Resolver
          </button>
        )}
        {solved && (
          <div
            className={`${styles.resultRow} ${isCorrect ? styles.resultWin : styles.resultLose}`}
            aria-live="polite"
          >
            {isCorrect ? (
              <>
                <span>Você acertou!</span>
                {data.reward && (
                  <span className={styles.rewardChip}>
                    +{data.reward.toLocaleString('pt-BR')} Fanpoints
                  </span>
                )}
              </>
            ) : (
              <span>Quase! A resposta certa estava destacada.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
