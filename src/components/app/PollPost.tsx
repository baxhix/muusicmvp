'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import VerifiedBadge from './VerifiedBadge';
import styles from './PollPost.module.css';

/* ── Types ─────────────────────────────────────────────────
 * Enquete / poll post — two vertical photos side by side, the
 * fanbase votes on which one Ana Castela should wear at the next
 * show (or any other binary choice). The shape stays generic so
 * the same component can host future polls beyond "Look A vs Look
 * B" — captions are passed in, no string is hardcoded.
 */
export interface PollOptionData {
  /** Stable id used by analytics + the local vote key. */
  id: string;
  /** Visible label below the photo (e.g. "Look 1 — Country chique"). */
  label: string;
  /** Full URL or local path to the vertical photo. */
  imageSrc: string;
  imageAlt: string;
  /** Initial vote count (snapshot at render time). Required so the
   *  percentages have a denominator > 0 once the viewer votes. */
  votes: number;
}

export interface PollPostData {
  user: string;
  avatar: string;
  time: string;
  /** Headline shown above the two options (e.g. "Qual look pro
   *  próximo show?"). */
  question: string;
  /** Exactly two options — keeps the layout balanced. The component
   *  isn't designed to handle 3+ choices. */
  options: [PollOptionData, PollOptionData];
  /** Fanpoints awarded for voting. Drives the "Votando você ganha
   *  N Fanpoints" footer line; omit to hide the reward note. */
  reward?: number;
}

/**
 * Vote-or-show-results state machine, kept in this single component
 * because the post is self-contained — backend doesn't store votes
 * yet, so the percentages are local & optimistic. Once a real
 * /api/feed/polls endpoint ships, replace `votes` + the `vote()`
 * handler with the server-driven values (the rest of the UI stays
 * untouched).
 */
export default function PollPost({ data }: { data: PollPostData }) {
  const [votedId, setVotedId] = useState<string | null>(null);
  // Local snapshot of vote counts so we can grow them with each
  // optimistic vote (just the viewer's own, +1 to the chosen option).
  const [counts, setCounts] = useState<[number, number]>([
    data.options[0].votes,
    data.options[1].votes,
  ]);

  const total = counts[0] + counts[1];
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const handleVote = (idx: 0 | 1) => {
    if (votedId) return; // one vote per viewer (client-side)
    const chosen = data.options[idx];
    setCounts((prev) => {
      const next: [number, number] = [...prev] as [number, number];
      next[idx] = next[idx] + 1;
      return next;
    });
    setVotedId(chosen.id);
    track('feed_poll_vote', {
      poll_question: data.question,
      option_id: chosen.id,
      option_label: chosen.label,
    });
  };

  return (
    <div className={styles.card}>
      {/* Header — matches MediaPost layout so polls feel native in
          the same feed stream. */}
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
        <span className={styles.kindChip} aria-hidden="true">Enquete</span>
      </div>

      {/* Question / prompt. */}
      <p className={styles.question}>{data.question}</p>

      {/* Side-by-side option grid. */}
      <div className={styles.grid}>
        {data.options.map((opt, i) => {
          const idx = i as 0 | 1;
          const isVoted = votedId === opt.id;
          const percentage = pct(counts[idx]);
          return (
            <div
              key={opt.id}
              className={`${styles.option} ${isVoted ? styles.optionChosen : ''}`}
            >
              <div className={styles.imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={opt.imageSrc}
                  alt={opt.imageAlt}
                  className={styles.image}
                />
                {/* After voting, render a translucent overlay that grows
                    from the bottom by `percentage` — gives the user a
                    visual bar without competing with the photo. */}
                {votedId && (
                  <div
                    className={styles.fill}
                    style={{ height: `${percentage}%` }}
                    aria-hidden="true"
                  />
                )}
                {votedId && (
                  <div className={styles.pctBadge} aria-hidden="true">
                    {percentage}%
                  </div>
                )}
              </div>

              <div className={styles.optionFooter}>
                <span className={styles.optionLabel}>{opt.label}</span>
                {votedId ? (
                  <span className={styles.voteCount}>
                    {counts[idx].toLocaleString('pt-BR')} {counts[idx] === 1 ? 'voto' : 'votos'}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.voteBtn}
                    onClick={() => handleVote(idx)}
                  >
                    Votar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reward footer — only when a reward is configured. Stays
          visible even after the vote so the user sees what they
          earned. */}
      {data.reward && data.reward > 0 && (
        <div className={styles.reward} aria-live="polite">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.3 21.4 12 18 5.7 21.4 7 14.4 2 9.5 8.9 8.6 12 2" />
          </svg>
          <span>
            {votedId
              ? `Você ganhou ${data.reward.toLocaleString('pt-BR')} Fanpoints!`
              : `Votando, você ganha ${data.reward.toLocaleString('pt-BR')} Fanpoints`}
          </span>
        </div>
      )}
    </div>
  );
}
