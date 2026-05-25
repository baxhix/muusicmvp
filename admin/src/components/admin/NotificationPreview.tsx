'use client';

import { IconBell, IconMail } from '@/components/icons';
import {
  CATEGORY_LABEL,
  type NotificationCategory,
} from '@/services/notifications';
import styles from './NotificationPreview.module.css';

interface NotificationPreviewProps {
  channel: 'in_app' | 'email';
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
 * Dois canais suportados:
 *  - in_app: phone frame mostrando o sino + dropdown com a entrada
 *  - email:  inbox row + corpo do email aberto
 *
 * Os mockups são **estáticos** — não são previews funcionais do
 * pipeline real (que usa o sistema de email templates). Servem só
 * pra dar a sensação de como o copy vai aparecer no contexto certo.
 *
 * Quando channelEnabled=false, mostra um overlay "Canal desligado"
 * pra deixar claro pro admin que esta notificação NÃO sai por aqui.
 */
export default function NotificationPreview({
  channel,
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

      {channel === 'in_app' ? (
        <InAppMockup
          label={label}
          description={description}
          trigger={trigger}
          category={category}
        />
      ) : (
        <EmailMockup label={label} description={description} />
      )}
    </div>
  );
}

/* ── In-app mockup (phone + bell dropdown) ─────────────────── */

function InAppMockup({
  label,
  description,
  trigger,
  category,
}: {
  label: string;
  description: string;
  trigger: string;
  category: NotificationCategory;
}) {
  return (
    <div className={styles.phoneFrame}>
      <div className={styles.phoneNotch} aria-hidden="true" />
      <div className={styles.phoneStatusBar}>
        <span>22:46</span>
        <span className={styles.phoneStatusRight}>
          <span aria-hidden="true">●●●</span>
          <span aria-hidden="true">100%</span>
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
    </div>
  );
}

/* ── Email mockup (inbox row + body) ────────────────────────── */

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
