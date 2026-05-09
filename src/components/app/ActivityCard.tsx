'use client';

import styles from './ActivityCard.module.css';

/* ── Types ── */
type CoListeningCard = {
  type: 'co_listening';
  user: string;
  avatar: string;
  song: string;
  albumArt: string;
};

type ChatInviteCard = {
  type: 'chat_invite';
  user: string;
  avatar: string;
};

type LikedCard = {
  type: 'liked';
  user: string;
  avatar: string;
};

type MessageRequestCard = {
  type: 'message_request';
  user: string;
  avatar: string;
  preview: string;
};

export type ActivityCardData =
  | CoListeningCard
  | ChatInviteCard
  | LikedCard
  | MessageRequestCard;

/* ── Component ── */
export default function ActivityCard({ data }: { data: ActivityCardData }) {
  const isMessage = data.type === 'message_request';

  const variantClass = {
    co_listening:    styles.variantCyan,
    chat_invite:     styles.variantPurple,
    liked:           styles.variantRed,
    message_request: styles.variantGreen,
  }[data.type];

  return (
    <div className={`${styles.card} ${isMessage ? styles.cardMessage : ''} ${variantClass}`}>

      {/* Main row */}
      <div className={styles.row}>

        {/* Avatar */}
        <div className={styles.avatarWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.avatar} alt={data.user} className={styles.avatar} />
        </div>

        {/* Text */}
        <div className={styles.text}>
          {data.type === 'co_listening' && (
            <><strong>{data.user}</strong> também ouvindo <strong>{data.song}</strong></>
          )}
          {data.type === 'chat_invite' && (
            <><strong>{data.user}</strong> te chamou para <strong>um chat</strong></>
          )}
          {data.type === 'liked' && (
            <><strong>{data.user}</strong> curtiu o que você está ouvindo</>
          )}
          {data.type === 'message_request' && (
            <><strong>{data.user}</strong> quer mandar mensagem para você</>
          )}
        </div>

        {/* Right slot */}
        {data.type === 'co_listening' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.albumArt} alt={data.song} className={styles.albumArt} />
        )}
        {data.type === 'liked' && (
          <span className={styles.heart}>♥</span>
        )}
      </div>

      {/* Message preview row */}
      {data.type === 'message_request' && (
        <div className={styles.messageBody}>
          <p className={styles.preview}>{data.preview}</p>
          <button className={styles.openBtn}>Abrir chat</button>
        </div>
      )}

    </div>
  );
}
