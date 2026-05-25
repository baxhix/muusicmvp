'use client';

import { IconBell, IconMail } from '@/components/icons';
import {
  CATEGORY_LABEL,
  type NotificationCategory,
} from '@/services/notifications';
import styles from './NotificationPreview.module.css';

export type PreviewDevice = 'iphone' | 'android' | 'email';

interface NotificationPreviewProps {
  /** iphone/android renderizam o mockup in-app com chrome distinto;
   *  email renderiza o mockup de inbox + corpo. */
  device: PreviewDevice;
  /** Title da notificação (label). */
  label: string;
  /** Body principal. */
  description: string;
  /** Contexto: o que disparou. Aparece como helper na in-app. */
  trigger: string;
  category: NotificationCategory;
  /** Quando false, o mockup mostra estado "desligado" — útil pro
   * admin entender que o user NÃO vai receber este aviso. */
  channelEnabled: boolean;
}

/**
 * Mockup visual da notificação tal como o usuário final recebe.
 *
 * Três devices suportados:
 *  - iphone:  iOS frame com Dynamic Island, status bar iOS, home indicator
 *  - android: Material frame com punch-hole, status bar Android, gesture pill
 *  - email:   inbox row + corpo do email aberto
 *
 * Os mockups são **estáticos** — não são previews funcionais do
 * pipeline real de delivery. Servem só pra dar a sensação de como
 * o copy vai aparecer no contexto certo.
 *
 * Quando channelEnabled=false, mostra um banner "Canal desligado"
 * + filter grayscale pra deixar claro pro admin que esta notificação
 * NÃO sai por aqui.
 */
export default function NotificationPreview({
  device,
  label,
  description,
  trigger,
  category,
  channelEnabled,
}: NotificationPreviewProps) {
  return (
    <div className={styles.wrap} data-disabled={!channelEnabled}>
      {!channelEnabled && (
        <div className={styles.disabledBanner}>
          Este canal está desligado — o usuário NÃO recebe esta
          notificação por aqui.
        </div>
      )}

      {device === 'email' ? (
        <EmailMockup label={label} description={description} />
      ) : (
        <PhoneMockup
          os={device}
          label={label}
          description={description}
          trigger={trigger}
          category={category}
        />
      )}
    </div>
  );
}

/* ── Phone mockups (iOS + Android) ──────────────────────────── */

function PhoneMockup({
  os,
  label,
  description,
  trigger,
  category,
}: {
  os: 'iphone' | 'android';
  label: string;
  description: string;
  trigger: string;
  category: NotificationCategory;
}) {
  const isIOS = os === 'iphone';

  return (
    <div
      className={`${styles.phoneFrame} ${
        isIOS ? styles.phoneFrameIOS : styles.phoneFrameAndroid
      }`}
    >
      {/* OS chrome — Dynamic Island (iOS) ou punch-hole (Android). */}
      {isIOS ? (
        <div className={styles.iosIsland} aria-hidden="true" />
      ) : (
        <div className={styles.androidHole} aria-hidden="true" />
      )}

      <div className={styles.phoneStatusBar}>
        <span className={styles.statusTime}>{isIOS ? '22:46' : '22:46'}</span>
        <span className={styles.phoneStatusRight}>
          {isIOS ? (
            <>
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </>
          ) : (
            <>
              <WifiIcon />
              <SignalIcon />
              <span className={styles.androidBattery}>100%</span>
            </>
          )}
        </span>
      </div>

      <div className={styles.appHeader}>
        <span className={styles.appBrand}>Fanverse</span>
        <div className={styles.bellWrap}>
          <span className={styles.bellIcon} aria-hidden="true">
            <IconBell size={16} />
          </span>
          <span className={styles.bellBadge}>1</span>
        </div>
      </div>

      <div className={styles.notifPanel}>
        <div className={styles.notifPanelHead}>
          <span>Notificações</span>
          <span className={styles.notifPanelHint}>Agora há pouco</span>
        </div>

        <div className={styles.notifItem}>
          <div className={styles.notifItemIcon}>
            <IconBell size={14} />
          </div>
          <div className={styles.notifItemBody}>
            <div className={styles.notifItemRow1}>
              <span className={styles.notifItemTitle}>{label}</span>
              <span className={styles.notifItemDot} aria-hidden="true" />
            </div>
            <span className={styles.notifItemDesc}>{description}</span>
            <div className={styles.notifItemMeta}>
              <span className={styles.notifItemCategory}>
                {CATEGORY_LABEL[category]}
              </span>
              <span className={styles.notifItemTime}>agora</span>
            </div>
          </div>
        </div>

        <div className={styles.notifTrigger}>
          <span className={styles.notifTriggerLabel}>Disparada quando</span>
          <span className={styles.notifTriggerText}>{trigger}</span>
        </div>
      </div>

      {/* Bottom chrome — home indicator (iOS) ou gesture pill (Android). */}
      <div
        className={isIOS ? styles.iosHomeIndicator : styles.androidGesturePill}
        aria-hidden="true"
      />
    </div>
  );
}

/* ── Tiny status bar icons (inline pra não acoplar com /icons) ── */

function SignalIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
      <rect x="0" y="7" width="2" height="3" rx="0.5" fill="currentColor" />
      <rect x="4" y="5" width="2" height="5" rx="0.5" fill="currentColor" />
      <rect x="8" y="3" width="2" height="7" rx="0.5" fill="currentColor" />
      <rect x="12" y="1" width="2" height="9" rx="0.5" fill="currentColor" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
      <path
        d="M7 9.5L8.5 7.5C7.7 6.9 6.3 6.9 5.5 7.5L7 9.5Z"
        fill="currentColor"
      />
      <path
        d="M7 4C5.2 4 3.5 4.65 2.2 5.75L3.4 7.05C4.4 6.2 5.65 5.7 7 5.7C8.35 5.7 9.6 6.2 10.6 7.05L11.8 5.75C10.5 4.65 8.8 4 7 4Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M7 0.5C4.35 0.5 1.9 1.45 0 3L1.2 4.3C2.8 3 4.85 2.2 7 2.2C9.15 2.2 11.2 3 12.8 4.3L14 3C12.1 1.45 9.65 0.5 7 0.5Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="9"
        rx="2"
        stroke="currentColor"
        opacity="0.55"
      />
      <rect x="2" y="2" width="16" height="6" rx="1" fill="currentColor" />
      <rect x="20.5" y="3" width="1.5" height="4" rx="0.6" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/* ── Email mockup ────────────────────────────────────────────── */

function EmailMockup({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className={styles.emailFrame}>
      {/* Inbox row (preview no inbox do user) */}
      <div className={styles.inboxWindow}>
        <div className={styles.inboxHead}>
          <span>Caixa de entrada</span>
          <span className={styles.inboxHint}>1 não lida</span>
        </div>
        <div className={styles.inboxRow}>
          <div className={styles.inboxAvatar} aria-hidden="true">F</div>
          <div className={styles.inboxBody}>
            <div className={styles.inboxRow1}>
              <span className={styles.inboxFrom}>Fanverse</span>
              <span className={styles.inboxTime}>agora</span>
            </div>
            <span className={styles.inboxSubject}>{label}</span>
            <span className={styles.inboxSnippet}>{description}</span>
          </div>
        </div>
      </div>

      {/* Corpo expandido do email */}
      <div className={styles.emailBody}>
        <div className={styles.emailBodyHeader}>
          <span className={styles.emailLogo} aria-hidden="true">
            <IconMail size={18} />
          </span>
          <span className={styles.emailFromName}>Fanverse</span>
        </div>
        <h1 className={styles.emailTitle}>{label}</h1>
        <p className={styles.emailParagraph}>{description}</p>
        <a className={styles.emailCta} href="#" onClick={(e) => e.preventDefault()}>
          Abrir no app
        </a>
        <div className={styles.emailFooter}>
          Você está recebendo este email porque tem uma conta no Fanverse.
          Pra ajustar preferências, acesse seu perfil.
        </div>
      </div>
    </div>
  );
}
