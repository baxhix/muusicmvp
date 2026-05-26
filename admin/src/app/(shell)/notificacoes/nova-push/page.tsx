'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import {
  IconCheckCircle,
  IconAlert,
  IconHome,
  IconChevronRight,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import NotificationPreview, {
  type PreviewDevice,
} from '@/components/admin/NotificationPreview';
import {
  buildCustomDraft,
  saveCustomDraft,
  loadCustomDrafts,
  CATEGORY_LABEL,
  type NotificationCategory,
} from '@/services/notifications';
import styles from './page.module.css';

/**
 * Página dedicada de criação de push notification.
 *
 * Antes essa criação acontecia num modal (NewNotificationDialog)
 * que abria sobre a listagem. Por feedback de produto, push virou
 * fluxo full-page — sem o modal antecedente, o admin entra direto
 * no formulário pra criar a push. Mantém o mesmo conjunto de
 * campos do dialog antigo: kind, label, description, trigger,
 * categoria. Defaults técnicos seguem placeholder ('in_app') até
 * o enum NotificationChannel ganhar 'push'.
 *
 * Plataforma continua usando o dialog modal — fluxo distinto por
 * canal foi feedback explícito ("nem sempre são iguais e enviadas
 * no mesmo tempo").
 */

/* Schema espelha a tabela `push_notifications` no Firebase. Os
 * campos auto-gerados (id, sender_id, created_at, sent_at) NÃO
 * aparecem no form — o banner avisa o admin. */

const TYPE_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: 'lifecycle',  label: CATEGORY_LABEL.lifecycle },
  { value: 'social',     label: CATEGORY_LABEL.social },
  { value: 'content',    label: CATEGORY_LABEL.content },
  { value: 'engagement', label: CATEGORY_LABEL.engagement },
];

/** Espelha o enum Firebase `target_type`: quem recebe a push.
 *  Quando a integração real subir, esses values batem 1:1 com a
 *  coluna. Default = todos os usuários. */
type TargetType =
  | 'all_users'
  | 'top_superfans'
  | 'inactive_users'
  | 'by_city'
  | 'single_user'
  | 'custom_list';

const TARGET_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'all_users',      label: 'Todos os usuários' },
  { value: 'top_superfans',  label: 'Top superfãs (top X% por fanpoints)' },
  { value: 'inactive_users', label: 'Inativos (X+ dias sem entrar)' },
  { value: 'by_city',        label: 'Por cidade' },
  { value: 'single_user',    label: 'Um usuário específico' },
  { value: 'custom_list',    label: 'Lista de emails' },
];

/** Slug a partir do título — usado pro kind interno do draft.
 *  Remove acentos, normaliza pra a-z0-9 + underscore, trunca em
 *  60 chars (limite do regex de validação do catálogo). */
function slugifyTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'push';
}

export default function NovaPushPage() {
  const router = useRouter();
  const { push } = useToast();

  /* Campos espelhando o schema Firebase `push_notifications`.
   * id/sender_id/created_at/sent_at são auto-gerados — não têm
   * input aqui (avisamos via banner). */
  const [title, setTitle] = useState('');           // → Firebase `title`
  const [body, setBody] = useState('');             // → Firebase `body`
  const [imageUrl, setImageUrl] = useState('');     // → Firebase `image_url`
  const [deepLink, setDeepLink] = useState('');     // → Firebase `deep_link`
  const [type, setType] = useState<NotificationCategory>('engagement'); // → `type`
  const [targetType, setTargetType] = useState<TargetType>('all_users'); // → `target_type`
  const [scheduledAt, setScheduledAt] = useState(''); // → Firebase `scheduled_at`
  const [saving, setSaving] = useState(false);
  /* Tab do preview — alterna entre mockup iPhone e Android.
   * Default iPhone porque é o mais comum. */
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('iphone');

  /* Lista de kinds existentes em localStorage. O kind é DERIVADO
   * do `title` no save — o admin não precisa pensar em slug. */
  const [existingKinds, setExistingKinds] = useState<string[]>([]);
  useEffect(() => {
    setExistingKinds(loadCustomDrafts().map((d) => d.kind));
  }, []);

  /* Validação rasa por campo. O `title` é obrigatório (define o
   * slug do draft). `body` também é (pra que a notificação tenha
   * conteúdo). image_url e deep_link são opcionais — quando
   * preenchidos, conferimos formato URL básico. */
  const trimmedTitle = title.trim();
  const titleError = useMemo(() => {
    if (!trimmedTitle) return 'Título obrigatório.';
    if (trimmedTitle.length > 100) return 'Máximo 100 caracteres.';
    const slug = slugifyTitle(trimmedTitle);
    if (existingKinds.includes(slug)) {
      return 'Já existe uma push com identificador semelhante. Escolha outro título.';
    }
    return null;
  }, [trimmedTitle, existingKinds]);

  const bodyError = !body.trim() ? 'Corpo obrigatório.' : null;

  const imageUrlError = useMemo(() => {
    if (!imageUrl.trim()) return null;
    try {
      const u = new URL(imageUrl.trim());
      if (!u.protocol.startsWith('http')) return 'Use https:// ou http://.';
      return null;
    } catch {
      return 'URL inválida.';
    }
  }, [imageUrl]);

  const canSubmit = !titleError && !bodyError && !imageUrlError && !saving;

  function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const slug = slugifyTitle(trimmedTitle);
    /* Defesa anti-race: re-checa contra localStorage no momento de
     * salvar (alguém pode ter criado um draft com mesmo kind em
     * outra aba). */
    const conflict = loadCustomDrafts().some((d) => d.kind === slug);
    if (conflict) {
      setSaving(false);
      push({
        type: 'error',
        title: 'Identificador já em uso',
        description: 'Já existe uma push com identificador semelhante.',
      });
      return;
    }
    /* O draft mocado em localStorage aceita só (kind, label,
     * description, trigger, category, channels). Os campos
     * Firebase extra (image_url, deep_link, target_type,
     * scheduled_at) seriam persistidos quando a integração real
     * subir — por enquanto entram no trigger como humano-readable
     * pra não perder o contexto. */
    const triggerDesc = [
      `Tipo: ${type}`,
      `Destinatário: ${targetType}`,
      scheduledAt ? `Agendado para ${scheduledAt}` : 'Envio imediato',
      imageUrl.trim() ? `Imagem: ${imageUrl.trim()}` : null,
      deepLink.trim() ? `Deep link: ${deepLink.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const draft = buildCustomDraft({
      kind: slug,
      label: trimmedTitle,
      description: body.trim(),
      trigger: triggerDesc,
      category: type,
      /* Placeholder até o enum NotificationChannel ganhar 'push' —
       * salvamos como in_app pra que a UI tenha algo coerente pra
       * renderizar nos badges. Quando push subir, trocar aqui. */
      supportedChannels: ['in_app'],
      defaultChannels: ['in_app'],
    });
    saveCustomDraft(draft);
    push({
      type: 'success',
      title: 'Push criada (planejada)',
      description: `"${draft.label}" está disponível na listagem.`,
    });
    /* Navega direto pro editor — UX "criou, agora edita". */
    router.push(`/notificacoes/${encodeURIComponent(draft.kind)}`);
  }

  function cancel() {
    /* Volta pra listagem mantendo a tab push ativa. Como a página
     * pai não persiste a tab via query string, simplesmente
     * voltamos pra /notificacoes (default cai em platform, mas o
     * user volta a clicar na push tab — trade-off aceitável). */
    router.push('/notificacoes');
  }

  return (
    <>
      <PageHeader
        title="Nova push notification"
        description="Notificação enviada ao app instalado no celular do usuário. Pode ser agendada em outro horário, segmento e copy — independente da plataforma."
      />

      <div className={styles.body}>
        {/* Breadcrumb estilo Materiais — botões com ícone home no
         * root + chevron como separador. Marca o caminho de volta
         * pra listagem pra quem entra direto pelo deep-link. */}
        <nav className={styles.breadcrumb} aria-label="Caminho">
          <button
            type="button"
            className={styles.crumb}
            onClick={() => router.push('/notificacoes')}
          >
            <IconHome size={13} />
            <span>Notificações</span>
          </button>
          <span className={styles.crumbGroup}>
            <IconChevronRight size={12} className={styles.crumbSep} />
            <button
              type="button"
              className={cn(styles.crumb, styles.crumbActive)}
              disabled
              aria-current="page"
            >
              Nova push notification
            </button>
          </span>
        </nav>

        {/* Layout 2 colunas: form à esquerda, preview do celular
         *  à direita (metade da área cada). Em telas < 1024 vira
         *  1 coluna com o preview embaixo. */}
        <div className={styles.splitLayout}>
          <Card>
            <CardHeader
              title="Detalhes da push"
              description="Campos alinhados com a tabela push_notifications do Firebase. id, sender_id, created_at e sent_at são preenchidos automaticamente no envio."
            />

            {/* Banner contextual — push ainda não dispara. */}
            <div className={styles.banner} role="status">
              <IconAlert size={14} />
              <span>
                Push notifications estão em desenvolvimento. O canal ainda
                não dispara automaticamente — o draft fica salvo como
                planejado e entra no ar quando a integração subir.
              </span>
            </div>

            <div className={styles.form}>
              <Input
                label="Título (title)"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Volta pra ver o que rolou"
                helperText={
                  titleError ??
                  'Texto em negrito que aparece na lockscreen. Curto e direto (máx ~50 chars pra não cortar).'
                }
                errorText={titleError && title.length > 0 ? titleError : undefined}
                maxLength={100}
              />

              <Textarea
                label="Corpo (body)"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Mensagem principal da push, sob o título."
                rows={2}
                maxLength={240}
                helperText={
                  bodyError ??
                  'Conteúdo principal da notificação. iOS/Android cortam com "..." em ~120 chars dependendo do device.'
                }
                errorText={bodyError && body.length > 0 ? bodyError : undefined}
              />

              <Input
                label="Imagem (image_url)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://muusic.live/images/push/exemplo.png"
                helperText={
                  imageUrlError ??
                  'Opcional. URL pública de uma imagem (PNG/JPG até ~1MB) que aparece junto da notificação. Vazio = só texto.'
                }
                errorText={imageUrlError ?? undefined}
                maxLength={500}
              />

              <Input
                label="Deep link (deep_link)"
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                placeholder="/app/feed ou fanverse://post/abc123"
                helperText="Opcional. Caminho do app que abre ao tocar na push. Vazio = abre na home (/app)."
                maxLength={500}
              />

              <div className={styles.row}>
                <Select
                  label="Tipo (type)"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as NotificationCategory)
                  }
                  options={TYPE_OPTIONS}
                  required
                  helperText="Categoria do push. Usado pra agrupamento e estatísticas no admin."
                />
                <Select
                  label="Destinatário (target_type)"
                  value={targetType}
                  onChange={(e) =>
                    setTargetType(e.target.value as TargetType)
                  }
                  options={TARGET_OPTIONS}
                  required
                  helperText="Quem recebe a push. 'Todos' ignora filtros; segmentos pegam uma fatia da base."
                />
              </div>

              <Input
                label="Agendamento (scheduled_at)"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                helperText="Opcional. Data e hora pra o envio. Vazio = enviar assim que aprovado. Após o disparo, sent_at é preenchido automaticamente."
              />
            </div>

            <footer className={styles.footer}>
              <Button
                variant="ghost"
                size="md"
                onClick={cancel}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                leadingIcon={<IconCheckCircle size={14} />}
                onClick={submit}
                loading={saving}
                disabled={!canSubmit}
              >
                Criar push
              </Button>
            </footer>
          </Card>

          {/* Preview do celular — sem Card chrome (sem título, sem
           *  descrição, sem background). Só as tabs iPhone/Android
           *  textuais + o mockup. trigger="" pra esconder o bloco
           *  "Disparada quando..." (controlado dentro do componente
           *  NotificationPreview por trigger.trim() !== ''). */}
          <div className={styles.previewSection}>
            <div
              className={styles.previewToggle}
              role="tablist"
              aria-label="Escolher mockup do celular"
            >
              <button
                type="button"
                role="tab"
                aria-selected={previewDevice === 'iphone'}
                className={cn(
                  styles.previewToggleBtn,
                  previewDevice === 'iphone' && styles.previewToggleActive,
                )}
                onClick={() => setPreviewDevice('iphone')}
              >
                iPhone
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewDevice === 'android'}
                className={cn(
                  styles.previewToggleBtn,
                  previewDevice === 'android' && styles.previewToggleActive,
                )}
                onClick={() => setPreviewDevice('android')}
              >
                Android
              </button>
            </div>
            <div className={styles.previewStage}>
              <NotificationPreview
                device={previewDevice}
                label={title || 'Título da push'}
                description={
                  body || 'Corpo da push aparece aqui — curto e direto.'
                }
                trigger=""
                category={type}
                channelEnabled
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
