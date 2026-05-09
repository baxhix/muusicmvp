'use client';

import styles from './SideBar.module.css';

const STORE_URL =
  'https://lojaanacastela.com.br/?srsltid=AfmBOoqO3lURzf9V03K4wnnoPrXa2sFOUu2r7DE9TJguEVZbdzGrWpka';

export default function SideBar() {
  return (
    <aside className={styles.bar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-muusic.svg"
        alt="muusic"
        className={styles.logo}
      />

      <a
        href={STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.storeLink}
        aria-label="Loja oficial Ana Castela"
        title="Loja oficial"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 8V6a3 3 0 0 1 6 0v2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </aside>
  );
}
