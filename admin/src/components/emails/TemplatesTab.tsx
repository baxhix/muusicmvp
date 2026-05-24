'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Dialog from '@/components/ui/Dialog';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { IconEdit, IconSend, IconCheckCircle } from '@/components/icons';
import { emailsService, type EmailTemplate } from '@/services/emails';
import {
  type EmailDesign,
  designToHtml,
  interpolatePreview,
} from '@/services/emailDesign';
import VisualEditor from './VisualEditor';
import styles from './TemplatesTab.module.css';

/**
 * Templates editáveis dos emails do sistema.
 *
 * Lista de cards (1 por template conhecido) + editor em dialog.
 *
 * No editor, toggle "Visual / HTML":
 *   - Visual: editor form-based (cores, blocos). Salva `design`
 *             JSON + html regenerado server-side. Padrão pra
 *             equipe de gestão.
 *   - HTML:   textarea raw. Salva só html, zera design. Pra dev
 *             que precisa de algo fora da grade visual.
 *
 * Quando o admin abre um template sem `design` salvo (primeira
 * vez), começa no modo Visual com o `defaultDesign` do
 * KNOWN_TEMPLATES. Se já tem design → carrega. Se editou em
 * HTML antes → o toggle pra Visual recomeça do `defaultDesign`
 * com aviso (perde-se o HTML editado manualmente).
 */
export default function TemplatesTab() {
  const [items, setItems] = useState<EmailTemplate[] | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const { push } = useToast();

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refetch() {
    emailsService.templates
      .list()
      .then((res) => setItems(res.items))
      .catch((err: unknown) => {
        push({
          type: 'error',
          title: 'Erro ao carregar templates',
          description: err instanceof Error ? err.message : 'Tente novamente.',
        });
        setItems([]);
      });
  }

  function handleSaved(t: EmailTemplate) {
    setItems((prev) =>
      prev ? prev.map((x) => (x.kind === t.kind ? t : x)) : prev,
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Templates do sistema"
          description="Subject + visual do email que o servidor usa quando dispara cada tipo. Modo Visual (form-based) pra editar sem mexer em HTML; modo HTML pra controle total. Desativar um template editado faz o sistema cair pro fallback hardcoded — kill switch seguro."
        />
        <div className={styles.grid}>
          {items === null && (
            <div className={styles.loading}>Carregando templates…</div>
          )}
          {items && items.length === 0 && (
            <div className={styles.empty}>Nenhum template cadastrado.</div>
          )}
          {items?.map((t) => (
            <article key={t.kind} className={styles.card}>
              <header className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>{t.label}</h3>
                  <div className={styles.cardKind}>
                    <code>{t.kind}</code>
                    {t.isEdited && t.isActive && (
                      <Badge tone="brand" size="sm" dot>Editado</Badge>
                    )}
                    {t.isEdited && !t.isActive && (
                      <Badge tone="neutral" size="sm">Editado · desativado</Badge>
                    )}
                    {!t.isEdited && (
                      <Badge tone="neutral" size="sm">Default</Badge>
                    )}
                    {t.design && (
                      <Badge tone="success" size="sm">Editor visual</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<IconEdit size={14} />}
                  onClick={() => setEditing(t)}
                >
                  Editar
                </Button>
              </header>
              <p className={styles.cardDescription}>{t.description}</p>
              <p className={styles.cardSubject}>
                <span className={styles.subjectLabel}>Assunto atual:</span>{' '}
                <span>{t.subject}</span>
              </p>
            </article>
          ))}
        </div>
      </Card>

      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            handleSaved(t);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

/* ── Editor dialog ───────────────────────────────────────────────── */

type EditorMode = 'visual' | 'html';

interface TemplateEditorProps {
  template: EmailTemplate;
  onClose: () => void;
  onSaved: (t: EmailTemplate) => void;
}

function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const { push } = useToast();
  const [subject, setSubject] = useState(template.subject);
  const [isActive, setIsActive] = useState(
    template.isActive || !template.isEdited,
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  /* Estado dos dois modos coexiste — admin pode flipar e voltar
   * sem perder o que digitou (até salvar). Quando salva, só o
   * modo ativo é enviado pro server. */
  const [mode, setMode] = useState<EditorMode>(
    template.design ? 'visual' : template.isEdited ? 'html' : 'visual',
  );
  const [design, setDesign] = useState<EmailDesign>(
    template.design ?? template.defaultDesign ?? makeFallbackDesign(template.label),
  );
  const [html, setHtml] = useState(template.html);

  /* Preview compartilhado entre os 2 modos. Visual = regenerado
   * a partir do design. HTML = direto do textarea. */
  const previewHtml = useMemo(() => {
    const raw = mode === 'visual' ? designToHtml(design) : html;
    return interpolatePreview(raw, template.variables);
  }, [mode, design, html, template.variables]);

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
      const res = await emailsService.templates.upsert(payload);
      push({
        type: 'success',
        title: 'Template salvo',
        description:
          'A próxima vez que esse email for disparado, usa a versão editada.',
      });
      onSaved({
        ...template,
        subject,
        html: res.template.html,
        design: (res.template.design as EmailDesign | null) ?? null,
        isActive,
        isEdited: true,
        updatedAt: new Date().toISOString(),
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

  function reset() {
    if (mode === 'visual') {
      setDesign(template.defaultDesign ?? makeFallbackDesign(template.label));
    } else {
      setHtml(template.defaultHtml);
    }
    setSubject(template.defaultSubject);
    setIsActive(false);
  }

  function switchTo(next: EditorMode) {
    /* Sair do Visual → HTML: preenche o textarea com o HTML
     * regenerado, pra o usuário ver e poder ajustar. */
    if (mode === 'visual' && next === 'html') {
      setHtml(designToHtml(design));
    }
    /* Sair de HTML → Visual: avisa que perde edits HTML. Se
     * havia design original carregamos ele de volta; senão, o
     * defaultDesign. */
    setMode(next);
  }

  return (
    <Dialog
      open
      onClose={() => (saving || testing ? undefined : onClose())}
      title={`Editar: ${template.label}`}
      description={template.description}
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<IconSend size={14} />}
            onClick={sendTest}
            loading={testing}
            disabled={saving}
          >
            Enviar teste pra mim
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
        </>
      }
    >
      <div className={styles.editorBody}>
        <div className={styles.editorMeta}>
          <label className={styles.activeToggle}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>
              Template ativo
              <small> (quando desligado, sistema usa o fallback hardcoded)</small>
            </span>
          </label>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={reset}
            disabled={saving}
          >
            Restaurar default
          </button>
        </div>

        <Input
          label="Assunto"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          helperText="Use {{variável}} pra valores dinâmicos."
        />

        {template.variables.length > 0 && (
          <div className={styles.varsBox}>
            <p className={styles.varsTitle}>Variáveis disponíveis:</p>
            <ul className={styles.varsList}>
              {template.variables.map((v) => (
                <li key={v.name}>
                  <code>{`{{${v.name}}}`}</code>
                  <span>{v.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs<EditorMode>
          items={[
            { id: 'visual', label: 'Editor visual' },
            { id: 'html',   label: 'HTML (avançado)' },
          ]}
          value={mode}
          onChange={switchTo}
          variant="pills"
        />

        <div className={styles.editorSplit}>
          <div className={styles.editorPane}>
            <label className={styles.paneLabel}>
              {mode === 'visual' ? 'Estrutura do email' : 'HTML cru'}
            </label>
            {mode === 'visual' ? (
              <VisualEditor value={design} onChange={setDesign} />
            ) : (
              <textarea
                className={styles.htmlEditor}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
              />
            )}
          </div>
          <div className={styles.editorPane}>
            <label className={styles.paneLabel}>Preview</label>
            <iframe
              className={styles.previewFrame}
              title="Preview"
              srcDoc={previewHtml}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** Quando o admin abre um template sem `defaultDesign` (templates
 *  legados ou orphan), monta um design mínimo razoável. */
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
        text: 'Edite este texto.',
      },
    ],
    footer: {
      enabled: true,
      text: 'Se você não pediu este email, ignore.',
    },
  };
}
