'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import { awardPoints } from '@/lib/rewards';
import VerifiedBadge from './VerifiedBadge';
import styles from './PollPost.module.css';

/* ── Action footer icons (chapéu / comment / send) ──
 * Mirrors the icons used in MediaPost so the Enquete card carries
 * the same engagement affordances as a regular feed post. SVGs are
 * inlined rather than imported from MediaPost to keep the
 * components decoupled (no cross-component primitives), with the
 * understanding that any visual update to the icon set needs to
 * land in both files. */
const HatIcon = () => (
  <svg viewBox="140 130 570 315" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M471.813,165.406c6.608,0,11.981,2.786,17.035,8.503l2.089,2.363l3.185,4.189l12.087,19.131
      c9.811,15.53,18.336,31.685,26.555,48.285l5.09,11.471c4.605,10.379,6.764,21.505,7.54,33.073l0.41,6.116l0.315,5.843l0.281,7.265
      l0.372,10.853l0.189,29.192c1.35,7.854,6.573,12.941,13.637,13.689c0.515,0.044,1.032,0.065,1.55,0.065
      c10.838,0,22.242-9.285,30.316-17.307l4.684-5.264l6.594-7.399l11.771-10.891l12.778-11.687c5.813-5.317,12.531-7.682,19.798-7.682
      c1.065,0,2.142,0.051,3.23,0.151c12.916,1.184,27.426,4.26,32.396,18.957c0.951,2.811,1.068,6.073,1.272,9.052l0.307,4.473
      l0.23,5.068l0.286,4.713l-0.072,38.611l-0.393,8.596c-0.38,8.308-7.694,13.145-14.813,13.274l-12.703,0.232l-2.82,0.289
      l-27.738,5.066c-28.356,5.844-56.578,10.17-85.176,12.697l-4.881,0.431l-4.49,0.373l-5.206,0.397l-5.512,0.391l-6.242,0.386
      l-5.384,0.317l-7.332,0.372l-9.633,0.397l-12.9,0.413l-58.453-0.007l-14.286-0.406l-11.021-0.397l-9.082-0.373l-8.592-0.408
      l-7.327-0.368l-5.729-0.323l-6.931-0.391l-6.235-0.375l-6.241-0.393l-5.889-0.384l-5.871-0.403l-4.849-0.381l-4.344-0.374
      l-4.667-0.402l-4.506-0.388l-4.505-0.387l-4.504-0.383l-4.85-0.406l-4.506-0.376l-4.85-0.403l-4.506-0.374l-4.85-0.402l-4.506-0.374
      l-4.851-0.403l-4.505-0.381l-4.505-0.389l-4.508-0.389l-4.157-0.378l-4.162-0.395l-3.814-0.371l-4.101-0.425l-13.722-1.657
      c-11.055-1.335-21.843-3.237-32.585-6.631c-7.188-2.272-14.019-3.972-21.455-4.64l-4.168-0.374
      c-3.638-0.327-7.086-0.531-10.672-1.725c-3.078-1.025-6.093-4.261-6.095-8.278l-0.035-65.23c-0.002-4.03,3.294-8.89,5.932-12.027
      c3.289-3.911,6.916-6.883,11.399-9.038c4.449-2.138,9.229-3.55,14.152-3.848l3.514-0.213l3.116,0.182
      c5.166,0.301,9.982,2.106,14.269,5.41c7.327,5.648,14.006,11.753,20.714,18.326l21.264,20.837c3.456,3.387,7.397,5.769,11.428,8.199
      c6.216,3.747,15.256,7.616,22.494,7.616c1.103,0,2.164-0.09,3.167-0.284c3.748-0.725,6.579-3.671,7.405-7.615
      c0.625-2.983,0.238-5.7,0.216-8.673l-0.232-30.538l-0.248-3.926l-0.264-4.674l-0.339-5.06l-0.348-5.448l0.035-9.618
      c0.957-12.815,6.523-24.79,12.583-35.624l9.761-17.451l13.81-22.227l18.681-30.327l7.984-11.66c2.755-4.023,7.547-5.35,12.279-5.35
      c1.289,0,2.572,0.098,3.81,0.267c8.413,1.15,16.579,4.202,23.193,10.207l5.998,6.455c2.573,2.77,6.134,4.169,9.728,4.169
      c2.472,0,4.96-0.662,7.153-1.996c1.488-0.906,3.094-1.285,4.719-1.285c1.713,0,3.448,0.421,5.094,1.092
      c2.465,1.005,4.751,1.807,6.81,1.807c2.25,0,4.228-0.958,5.874-3.659c0.916-1.503,2.08-3.174,3.281-4.392
      c6.957-7.062,13.972-11.901,23.517-13.276C469.336,165.5,470.596,165.406,471.813,165.406z"/>
  </svg>
);
const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

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
  // Engagement footer state — the Enquete card now wears the same
  // chapéu / comment / send affordances as MediaPost. Backend
  // doesn't store likes-on-polls yet (mirrors MediaPost's optimistic
  // pattern), so the chapéu is a viewer-local toggle for now.
  const [liked, setLiked] = useState(false);

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

      {/* Reward line — centered right below the Votar buttons per
          product feedback. The amount is rendered inside a
          <strong> so the number reads as the primary signal;
          surrounding copy is quieter gray. No background — the
          chip was reading as a separate widget when it was
          tinted, so we kept it as inline text. */}
      {data.reward && data.reward > 0 && (
        <p className={styles.reward} aria-live="polite">
          {votedId ? (
            <>
              Você ganhou{' '}
              <strong className={styles.rewardAmount}>
                {data.reward.toLocaleString('pt-BR')} Fanpoints
              </strong>
              !
            </>
          ) : (
            <>
              Votando, você ganha{' '}
              <strong className={styles.rewardAmount}>
                {data.reward.toLocaleString('pt-BR')} Fanpoints
              </strong>
            </>
          )}
        </p>
      )}

      {/* Action footer — chapéu / comment / send. Same affordance
          MediaPost shows so the Enquete card carries the same
          engagement signals across the feed. The chapéu is a
          viewer-local toggle for now; backend storage for poll
          likes lands when the polls API ships. The comment and
          send icons are visual affordances — when the polls API
          surfaces, the comment button hooks into the same
          CommentsPanel pattern MediaPost uses. */}
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnHat} ${liked ? styles.btnLiked : ''}`}
          onClick={() => {
            setLiked((prev) => {
              const next = !prev;
              if (next) {
                // Polls don't have a dedicated like endpoint yet, so
                // we fire the helper without an apiPath — the toast
                // + analytics happen, but the FP ledger stays
                // unaffected until a /api/feed/polls/:id/like route
                // ships. Local state remains the source of truth
                // for the heart fill in the meantime.
                void awardPoints('like', {
                  analyticsContext: {
                    poll_question: data.question,
                  },
                });
              }
              return next;
            });
          }}
          aria-label={liked ? 'Descurtir enquete' : 'Curtir enquete'}
          aria-pressed={liked}
        >
          <HatIcon />
          {liked ? 1 : null}
        </button>
        <button
          type="button"
          className={styles.btn}
          aria-label="Comentar"
        >
          <CommentIcon />
        </button>
        <div className={styles.spacer} />
        <button
          type="button"
          className={styles.btn}
          aria-label="Enviar enquete"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
