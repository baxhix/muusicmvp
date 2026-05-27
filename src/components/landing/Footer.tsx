import styles from './Footer.module.css';

export default function Footer() {
  return (
    <>
      {/* Download Section */}
      <section className="section" id="download" style={{ padding: '120px 56px', maxWidth: '1440px', margin: '0 auto' }}>
        <div className={styles.downloadSection}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            <span style={{ width: 18, height: 1, background: 'var(--ink-faint)', display: 'inline-block' }} />
            Disponível em breve
          </span>
          <h2 className={styles.downloadTitle}>
            Baixe o <em>Fanverse</em>.
          </h2>
          <p className={styles.downloadSub}>
            Faça parte do universo de fãs. Disponível para iOS e Android no lançamento.
          </p>
          <div className={styles.downloadCtas}>
            <a className={styles.storeBtn} href="#">
              <span className={styles.storeBtnIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.86-3.08.43-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.43C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </span>
              <span className={styles.storeBtnText}>
                <small>Baixar na</small>
                <strong>App Store</strong>
              </span>
            </a>
            <a className={styles.storeBtn} href="#">
              <span className={styles.storeBtnIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.79 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zM14.84 13.05l2.72 2.72-11.84 6.83 9.12-9.55zM21.04 11.04a1.005 1.005 0 010 1.92l-3.32 1.92-2.96-2.88 2.96-2.88 3.32 1.92zM5.72 1.4l11.84 6.83-2.72 2.72L5.72 1.4z"/>
                </svg>
              </span>
              <span className={styles.storeBtnText}>
                <small>Disponível no</small>
                <strong>Google Play</strong>
              </span>
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.grid}>
            <div className={styles.brandCol}>
              <h4>Fanverse</h4>
              <p>O universo dos superfãs. Conexão, descoberta e cultura — em qualquer canto do mundo.</p>
            </div>
            <div className={styles.col}>
              <h5>Empresa</h5>
              <ul>
                <li><a href="#">Sobre</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Imprensa</a></li>
              </ul>
            </div>
            <div className={styles.col}>
              <h5>Artistas</h5>
              <ul>
                <li><a href="#artists">Para artistas</a></li>
                <li><a href="#">Para escritórios</a></li>
                <li><a href="#">API</a></li>
              </ul>
            </div>
            <div className={styles.col}>
              <h5>Legal</h5>
              <ul>
                <li><a href="/privacidade">Privacidade</a></li>
                <li><a href="/termos">Termos</a></li>
                <li><a href="#">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className={styles.bottom}>
            <div className={styles.socials}>
              <a href="#" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="3" width="18" height="18" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/>
                </svg>
              </a>
              <a href="#" aria-label="Spotify">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.214c3.81-.871 7.077-.496 9.713 1.114a.622.622 0 01.206.857zm1.224-2.722a.778.778 0 01-1.07.257c-2.687-1.652-6.785-2.13-9.965-1.166a.778.778 0 11-.452-1.49c3.632-1.102 8.147-.568 11.231 1.328a.778.778 0 01.256 1.07zm.105-2.835c-3.223-1.914-8.54-2.09-11.617-1.156a.933.933 0 11-.541-1.787c3.532-1.072 9.404-.865 13.115 1.338a.933.933 0 01-.957 1.605z"/>
                </svg>
              </a>
            </div>
            <span className={styles.copy}>© 2026 FANVERSE · ALL RIGHTS RESERVED</span>
            <div className={styles.spacer} />
          </div>
        </div>
      </footer>
    </>
  );
}
