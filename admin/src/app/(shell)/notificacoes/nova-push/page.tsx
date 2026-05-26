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

const CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: 'lifecycle',  label: CATEGORY_LABEL.lifecycle },
  { value: 'social',     label: CATEGORY_LABEL.social },
  { value: 'content',    label: CATEGORY_LABEL.content },
  { value: 'engagement', label: CATEGORY_LABEL.engagement },
];

const KIND_REGEX = /^[a-z0-9_]+$/;

export default function NovaPushPage() {
  const router = useRouter();
  const { push } = useToast();

  const [kind, setKind] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('engagement');
  const [saving, setSaving] = useState(false);

  /* Lista de kinds existentes — usado pra validar duplicado contra
   * drafts em localStorage. O catálogo do servidor não é checado
   * aqui (race aceitável pra demo), mas o save final faz re-check. */
  const [existingKinds, setExistingKinds] = useState<string[]>([]);
  useEffect(() => {
    setExistingKinds(loadCustomDrafts().map((d) => d.kind));
  }, []);

  const trimmedKind = kind.trim().toLowerCase();
  const kindError = useMemo(() => {
    if (!trimmedKind) return 'Identificador obrigatório.';
    if (trimmedKind.length > 60) return 'Máximo 60 caracteres.';
    if (!KIND_REGEX.test(trimmedKind))
      return 'Use só letras minúsculas, números e _.';
    if (existingKinds.includes(trimmedKind))
      return 'Já existe uma notificação com esse identificador.';
    return null;
  }, [trimmedKind, existingKinds]);

  const labelError = !label.trim() ? 'Obrigatório.' : null;
  const canSubmit = !kindError && !labelError && !saving;

  function submit() {
    if (!canSubmit) return;
    setSaving(true);
    /* Defesa anti-race: re-checa contra localStorage no momento de
     * salvar (alguém pode ter criado um draft com mesmo kind em
     * outra aba). */
    const conflict = loadCustomDrafts().some((d) => d.kind === trimmedKind);
    if (conflict) {
      setSaving(false);
      push({
        type: 'error',
        title: 'Identificador já em uso',
        description: 'Escolha um nome diferente — esse já foi cadastrado.',
      });
      return;
    }
    const draft = buildCustomDraft({
      kind: trimmedKind,
      label: label.trim(),
      description: description.trim() || 'Sem descrição.',
      trigger: trigger.trim() || 'Gatilho a definir.',
      category,
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

        <Card>
          <CardHeader
            title="Detalhes da push"
            description="Preencha identificador, copy e gatilho. O draft fica salvo como planejado até o canal push subir."
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
            <div className={styles.row}>
              <Input
                label="Identificador (kind)"
                required
                value={kind}
                onChange={(e) =>
                  setKind(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  )
                }
                placeholder="ex: push_winback_3d"
                helperText={
                  kindError ?? 'Usado em código + nos logs. Não muda depois.'
                }
                errorText={kindError && kind ? kindError : undefined}
                maxLength={60}
              />
              <Input
                label="Nome / título"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex: Volta pra ver o que rolou"
                errorText={
                  labelError && label.length > 0 ? labelError : undefined
                }
                maxLength={200}
              />
            </div>

            <Textarea
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texto curto e direto — push tem limite de caracteres e o usuário lê na lockscreen."
              rows={2}
              maxLength={2000}
            />

            <Textarea
              label="Quando dispara (agenda ou evento)"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="Ex: Diariamente às 9h pros usuários que não abriram o app em 3+ dias."
              rows={2}
              maxLength={2000}
            />

            <Select
              label="Categoria"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as NotificationCategory)
              }
              options={CATEGORY_OPTIONS}
              required
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
      </div>
    </>
  );
}
