'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { emailsService } from '@/services/emails';
import {
  DEFAULT_THEME,
  newBlockId,
  type EmailDesign,
} from '@/services/emailDesign';
import styles from './CreateTemplateDialog.module.css';

interface CreateTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Cria um template custom — slug (kind), nome legível, descrição.
 * Após criar com design vazio, redireciona pro editor full-page
 * pra a equipe começar a desenhar.
 *
 * Slug é validado com `^[a-z0-9_]+$` (mesma regex do server) e
 * sugerido a partir do nome legível em tempo real.
 *
 * Importante: criar um template aqui só vai pro DB. Pra que ele
 * seja disparado em algum fluxo do produto, o backend precisa
 * chamar `sendEmail({ kind: 'seu_kind', ... })`. Esta UI alerta
 * sobre isso com um hint discreto.
 */
export default function CreateTemplateDialog({
  open,
  onClose,
  onCreated,
}: CreateTemplateDialogProps) {
  const router = useRouter();
  const { push } = useToast();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [kindEdited, setKindEdited] = useState(false);

  function suggestKind(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  function reset() {
    setLabel('');
    setKind('');
    setDescription('');
    setKindEdited(false);
  }

  function handleLabelChange(value: string) {
    setLabel(value);
    if (!kindEdited) {
      setKind(suggestKind(value));
    }
  }

  function handleKindChange(value: string) {
    setKindEdited(true);
    setKind(value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  }

  const kindValid = /^[a-z0-9_]+$/.test(kind);
  const canSubmit =
    label.trim().length > 0 && kind.length > 0 && kindValid && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const design = emptyDesignFor(label);
      await emailsService.templates.upsert({
        kind,
        subject: `${label}`,
        html: '', // server regenera a partir do design
        design,
        isActive: false, // começa desativado até admin revisar
        description: description.trim() || undefined,
      });
      push({
        type: 'success',
        title: 'Template criado',
        description: 'Agora customize o conteúdo e ative.',
      });
      reset();
      onCreated();
      router.push(`/emails/templates/${kind}/edit`);
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao criar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => (saving ? undefined : (reset(), onClose()))}
      title="Criar novo template"
      description="Use pra preparar emails que ainda não estão no sistema (boas-vindas, recuperação, anúncios, etc.)."
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={saving}
            disabled={!canSubmit}
          >
            Criar e abrir editor
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <Input
          label="Nome do template"
          required
          autoFocus
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Ex.: Boas-vindas, Recuperação de senha"
          helperText="Como o template aparece pra a equipe no admin."
        />

        <div>
          <Input
            label="Identificador técnico (slug)"
            required
            value={kind}
            onChange={(e) => handleKindChange(e.target.value)}
            placeholder="Ex.: welcome, password_reset"
            helperText={
              kind.length > 0 && !kindValid
                ? '⚠ Só pode conter minúsculas, números e underscore.'
                : 'Só minúsculas, números e underscore. Usado pelo backend pra disparar.'
            }
          />
        </div>

        <Input
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Quando esse email é disparado?"
          helperText="Aparece no card do template pra contextualizar a equipe."
        />

        <div className={styles.hint}>
          <strong>Dica:</strong> templates custom só são disparados quando o
          código do backend chama <code>sendEmail{`(`}{`{`}kind: &apos;{kind || 'seu_slug'}&apos;{`}`}{`)`}</code>.
          Criar aqui prepara o visual; pra ativar o fluxo, alinhe com o time
          de engenharia.
        </div>
      </div>
    </Dialog>
  );
}

function emptyDesignFor(label: string): EmailDesign {
  return {
    version: 1,
    theme: { ...DEFAULT_THEME },
    header: { enabled: true, title: label || 'Novo email' },
    blocks: [
      {
        id: newBlockId(),
        kind: 'paragraph',
        text: 'Edite este texto com a mensagem principal.',
      },
    ],
    footer: {
      enabled: true,
      text: 'Se você não pediu este email, ignore.',
    },
  };
}
