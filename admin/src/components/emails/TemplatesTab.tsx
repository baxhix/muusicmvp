'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { IconEdit, IconSend, IconCheckCircle } from '@/components/icons';
import { emailsService, type EmailTemplate } from '@/services/emails';
import styles from './TemplatesTab.module.css';

/**
 * Templates editáveis dos emails do sistema.
 *
 * Cada card mostra um template "conhecido" (magic_link, etc.).
 * Click "Editar" abre o editor: subject + HTML + preview lado a
 * lado, lista de {{variáveis}} disponíveis, botão "Enviar teste".
 *
 * "Editado" badge aparece quando o registro do DB sobrescreveu o
 * default. Toggle "Ativo" controla se o template do DB é usado
 * (false = fallback pro hardcoded em código).
 */
export default function TemplatesTab() {
  const [items, setItems] = useState<EmailTemplate[] | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const { push } = useToast();

  useEffect(() => {
    refetch();
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
          description="Subject + HTML que o servidor usa quando dispara cada tipo de email. Se desativar um template editado, o sistema cai pro fallback hardcoded — kill switch seguro."
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

interface TemplateEditorProps {
  template: EmailTemplate;
  onClose: () => void;
  onSaved: (t: EmailTemplate) => void;
}

function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const { push } = useToast();
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [isActive, setIsActive] = useState(template.isActive || !template.isEdited);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await emailsService.templates.upsert({
        kind: template.kind,
        subject,
        html,
        isActive,
        description: template.description,
      });
      push({
        type: 'success',
        title: 'Template salvo',
        description: 'A próxima vez que esse email for disparado, usa a versão editada.',
      });
      onSaved({
        ...template,
        subject,
        html,
        isActive,
        isEdited: true,
        updatedAt: res.template.updatedAt
          ? new Date(res.template.updatedAt as unknown as string).toISOString()
          : new Date().toISOString(),
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
      const res = await emailsService.templates.test({
        kind: template.kind,
        subject,
        html,
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
    setSubject(template.defaultSubject);
    setHtml(template.defaultHtml);
    setIsActive(false);
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
            disabled={testing || !subject.trim() || !html.trim()}
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

        <div className={styles.editorSplit}>
          <div className={styles.editorPane}>
            <label className={styles.paneLabel}>HTML</label>
            <textarea
              className={styles.htmlEditor}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className={styles.editorPane}>
            <label className={styles.paneLabel}>Preview</label>
            <iframe
              className={styles.previewFrame}
              title="Preview"
              srcDoc={previewWithFakeVars(html, template.variables)}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** Substitui {{vars}} por valores fictícios pro preview ficar
 *  renderizado igual ao email final. Vars desconhecidas
 *  permanecem inalteradas — facilita debug visual. */
function previewWithFakeVars(
  html: string,
  vars: { name: string; description: string }[],
): string {
  const fakes: Record<string, string> = {
    magicUrl: 'https://example.com/preview',
    code: '123456',
    email: 'usuario@example.com',
    userName: 'João',
  };
  let out = html;
  for (const v of vars) {
    const replacement = fakes[v.name] ?? `[${v.name}]`;
    out = out.replaceAll(`{{${v.name}}}`, replacement);
  }
  return out;
}
