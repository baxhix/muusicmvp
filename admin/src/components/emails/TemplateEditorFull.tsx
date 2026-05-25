'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconChevronLeft,
  IconSend,
  IconCheckCircle,
  IconTrash,
} from '@/components/icons';
import { emailsService, type EmailTemplate } from '@/services/emails';
import {
  type EmailDesign,
  designToHtml,
  interpolatePreview,
} from '@/services/emailDesign';
import VisualEditor from './VisualEditor';
import DevicePreview from './DevicePreview';
import styles from './TemplateEditorFull.module.css';

interface TemplateEditorFullProps {
  template: EmailTemplate;
}

type EditorMode = 'visual' | 'html';
type ViewMode = 'editor' | 'preview';

/**
 * Editor de template full-page (rota dedicada).
 *
 * Layout:
 *   - Topbar fixo: voltar + nome + ações (teste, salvar, status)
 *   - Desktop: sidebar 360px com controles + preview canvas
 *   - Mobile: tabs "Editar" / "Preview" empilhadas
 *
 * Preview usa DevicePreview com toggle Mobile/Desktop pra simular
 * o email no destinatário final. Iframe sandboxado pra CSS não
 * vazar do admin pro template.
 */
export default function TemplateEditorFull({ template }: TemplateEditorFullProps) {
  const router = useRouter();
  const { push } = useToast();

  const [subject, setSubject] = useState(template.subject);
  const [isActive, setIsActive] = useState(
    template.isActive || !template.isEdited,
  );
  const [mode, setMode] = useState<EditorMode>(
    template.design ? 'visual' : template.isEdited ? 'html' : 'visual',
  );
  const [design, setDesign] = useState<EmailDesign>(
    template.design ?? template.defaultDesign ?? makeFallbackDesign(template.label),
  );
  const [html, setHtml] = useState(template.html);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Mobile: alterna Editor ↔ Preview por tab. */
  const [view, setView] = useState<ViewMode>('editor');

  /* Preview HTML — gerado a partir do design (modo visual) ou
   * direto do textarea (modo HTML). Vars fictícias substituídas
   * pra renderizar exatamente como o destinatário verá. */
  const previewHtml = useMemo(() => {
    const raw = mode === 'visual' ? designToHtml(design) : html;
    return interpolatePreview(raw, template.variables);
  }, [mode, design, html, template.variables]);

  /* Templates conhecidos (no catálogo de código) só podem ter o
   * row DB deletado pra "voltar pro default". Templates custom
   * podem ser deletados de vez. UI distingue. */
  const isKnown = template.defaultDesign !== null;

  async function save() {
    setSaving(true);
    try {
      const payload =
        mode === 'visual'
          ? {
              kind: template.kind,
              subject,
              html: '',
              design,
              isActive,
              description: template.description,
            }
          : {
              kind: template.kind,
              subject,
              html,
              design: null,
              isActive,
              description: template.description,
            };
      await emailsService.templates.upsert(payload);
      push({
        type: 'success',
        title: 'Template salvo',
        description: 'Próximos disparos usam a nova versão.',
      });
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const rawHtml = mode === 'visual' ? designToHtml(design) : html;
      const res = await emailsService.templates.test({
        kind: template.kind,
        subject,
        html: rawHtml,
      });
      push({
        type: 'success',
        title: 'Email de teste enviado',
        description: `Cheque a caixa de ${res.sentTo}.`,
      });
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao enviar teste',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setTesting(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await emailsService.templates.remove(template.kind);
      push({
        type: 'success',
        title: isKnown ? 'Template restaurado ao default' : 'Template removido',
        description: isKnown
          ? 'Sistema voltou a usar o conteúdo padrão hardcoded.'
          : 'O template custom foi apagado.',
      });
      router.push('/emails?tab=templates');
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao remover',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function switchMode(next: EditorMode) {
    if (mode === 'visual' && next === 'html') {
      setHtml(designToHtml(design));
    }
    setMode(next);
  }

  return (
    <div className={styles.root}>
      {/* ── Topbar fixo ──────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.push('/emails?tab=templates')}
            aria-label="Voltar"
          >
            <IconChevronLeft size={16} />
            <span>Templates</span>
          </button>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{template.label}</h1>
            <div className={styles.titleMeta}>
              <code className={styles.kindBadge}>{template.kind}</code>
              {template.isEdited && isActive && (
                <Badge tone="brand" size="sm" dot>Editado · ativo</Badge>
              )}
              {template.isEdited && !isActive && (
                <Badge tone="neutral" size="sm">Editado · desativado</Badge>
              )}
              {!template.isEdited && (
                <Badge tone="neutral" size="sm">Default</Badge>
              )}
              {!isKnown && (
                <Badge tone="warning" size="sm">Custom</Badge>
              )}
            </div>
          </div>
        </div>

        <div className={styles.topbarRight}>
          <label className={styles.activeToggle}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Ativo</span>
          </label>
          {template.isEdited && (
            <Button
              variant="dangerGhost"
              size="sm"
              iconOnly
              aria-label="Remover"
              title={isKnown ? 'Restaurar default' : 'Remover template'}
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash size={14} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<IconSend size={14} />}
            onClick={sendTest}
            loading={testing}
            disabled={saving}
          >
            Enviar teste
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconCheckCircle size={14} />}
            onClick={save}
            loading={saving}
            disabled={testing || !subject.trim()}
          >
            Salvar
          </Button>
        </div>
      </header>

      {/* ── Mobile view tabs ─────────────────────────────────── */}
      <div className={styles.mobileTabs}>
        <Tabs<ViewMode>
          items={[
            { id: 'editor',  label: 'Editar' },
            { id: 'preview', label: 'Preview' },
          ]}
          value={view}
          onChange={setView}
          variant="pills"
        />
      </div>

      {/* ── Body: sidebar + canvas ───────────────────────────── */}
      <div className={styles.body}>
        <aside
          className={`${styles.sidebar} ${view === 'editor' ? styles.activeMobile : styles.hiddenMobile}`}
        >
          <div className={styles.sidebarInner}>
            <section className={styles.section}>
              <Input
                label="Assunto"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                helperText="Aparece como título da mensagem no inbox. Use {{var}}."
              />
            </section>

            {template.variables.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionTitle}>Variáveis disponíveis</div>
                <ul className={styles.varsList}>
                  {template.variables.map((v) => (
                    <li key={v.name}>
                      <code>{`{{${v.name}}}`}</code>
                      <span>{v.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.section}>
              <Tabs<EditorMode>
                items={[
                  { id: 'visual', label: 'Visual' },
                  { id: 'html',   label: 'HTML' },
                ]}
                value={mode}
                onChange={switchMode}
                variant="pills"
              />
            </section>

            <section className={styles.editorSection}>
              {mode === 'visual' ? (
                <VisualEditor value={design} onChange={setDesign} />
              ) : (
                <div className={styles.htmlMode}>
                  <p className={styles.htmlHint}>
                    Editando o HTML cru. Voltar pro Visual recomeça do design padrão (perde edições do HTML).
                  </p>
                  <textarea
                    className={styles.htmlEditor}
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}
            </section>
          </div>
        </aside>

        <main
          className={`${styles.canvas} ${view === 'preview' ? styles.activeMobile : styles.hiddenMobile}`}
        >
          <DevicePreview html={previewHtml} subject={subject} />
        </main>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => (deleting ? undefined : setConfirmDelete(false))}
        onConfirm={doDelete}
        loading={deleting}
        destructive
        title={isKnown ? 'Restaurar default?' : 'Remover template?'}
        description={
          isKnown
            ? 'A versão editada será apagada e o sistema voltará a usar o conteúdo hardcoded original.'
            : 'O template será removido permanentemente. Essa ação não pode ser desfeita.'
        }
        confirmLabel={isKnown ? 'Restaurar' : 'Remover'}
      />
    </div>
  );
}

function makeFallbackDesign(label: string): EmailDesign {
  return {
    version: 1,
    theme: {
      bgColor: '#f6f6f7',
      contentBg: '#ffffff',
      textColor: '#111111',
      mutedColor: '#888888',
      linkColor: '#000000',
      buttonBg: '#000000',
      buttonText: '#ffffff',
      buttonRadius: 999,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    header: { enabled: true, title: label },
    blocks: [
      {
        id: 'fallback-1',
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
