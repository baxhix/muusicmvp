'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Dialog from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconSend,
  IconUsers,
  IconRefresh,
} from '@/components/icons';
import { formatNumber } from '@/lib/format';
import {
  emailsService,
  type EmailCampaign,
  type SegmentKind,
} from '@/services/emails';
import styles from './CampaignsTab.module.css';

const SEGMENT_OPTIONS: { value: SegmentKind; label: string }[] = [
  { value: 'all',           label: 'Todos os usuários ativos' },
  { value: 'superfans',     label: 'Superfãs (top X% por fanpoints)' },
  { value: 'inactive',      label: 'Inativos (sem login há N dias)' },
  { value: 'city',          label: 'Cidade específica' },
  { value: 'custom_emails', label: 'Lista de emails (cole abaixo)' },
];

function statusBadge(status: EmailCampaign['status']) {
  switch (status) {
    case 'draft':    return <Badge tone="neutral" size="sm">Rascunho</Badge>;
    case 'sending':  return <Badge tone="brand"  size="sm" dot>Enviando</Badge>;
    case 'sent':     return <Badge tone="success" size="sm" dot>Enviada</Badge>;
    case 'failed':   return <Badge tone="danger"  size="sm" dot>Falhou</Badge>;
    case 'canceled': return <Badge tone="neutral" size="sm">Cancelada</Badge>;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Campanhas — broadcasts criados pelo admin.
 *
 * Lista no topo (cards com progresso visual pra 'sending') +
 * botão "Nova campanha" que abre o composer (dialog com subject +
 * HTML + segment picker + preview de contagem).
 *
 * Polling automático a cada 5s enquanto qualquer campanha estiver
 * em 'sending', pra atualizar sent_count/failed_count.
 */
export default function CampaignsTab() {
  const [items, setItems] = useState<EmailCampaign[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    refetch();
  }, []);

  // Polling enquanto houver campanha em 'sending'.
  useEffect(() => {
    if (!items?.some((c) => c.status === 'sending')) return;
    const handle = setInterval(refetch, 5000);
    return () => clearInterval(handle);
  }, [items]);

  function refetch() {
    emailsService.campaigns
      .list()
      .then((res) => setItems(res.items))
      .catch((err: unknown) => {
        push({
          type: 'error',
          title: 'Erro ao carregar campanhas',
          description: err instanceof Error ? err.message : '',
        });
        setItems([]);
      });
  }

  async function confirmSend() {
    if (!sendingId) return;
    try {
      await emailsService.campaigns.send(sendingId);
      push({
        type: 'success',
        title: 'Campanha enfileirada',
        description: 'O envio começou. Status atualiza em tempo real.',
      });
      refetch();
    } catch (err) {
      push({
        type: 'error',
        title: 'Não foi possível enviar',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setSendingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Campanhas"
          description="Broadcasts por segmento de usuários. Throttle de 8 emails/s pra respeitar quota Resend. Histórico de cada envio aparece na aba Histórico, agrupado pela campanha."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={() => setComposing(true)}
            >
              Nova campanha
            </Button>
          }
        />

        {items === null && (
          <div className={styles.empty}>Carregando campanhas…</div>
        )}
        {items && items.length === 0 && (
          <div className={styles.empty}>
            Nenhuma campanha criada ainda. Clique em &ldquo;Nova campanha&rdquo; pra começar.
          </div>
        )}

        <div className={styles.list}>
          {items?.map((c) => {
            const progress =
              c.totalRecipients > 0
                ? Math.round(((c.sentCount + c.failedCount) / c.totalRecipients) * 100)
                : 0;
            return (
              <article key={c.id} className={styles.card}>
                <header className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>{c.name}</h3>
                    <p className={styles.cardMeta}>
                      Criada em {formatDate(c.createdAt)} ·{' '}
                      <code>{c.segment}</code>
                    </p>
                  </div>
                  <div className={styles.cardStatus}>
                    {statusBadge(c.status)}
                    {c.status === 'draft' && (
                      <Button
                        variant="primary"
                        size="sm"
                        leadingIcon={<IconSend size={14} />}
                        onClick={() => setSendingId(c.id)}
                      >
                        Disparar
                      </Button>
                    )}
                    {c.status === 'sending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<IconRefresh size={14} />}
                        onClick={refetch}
                      >
                        Atualizar
                      </Button>
                    )}
                  </div>
                </header>

                <p className={styles.cardSubject}>{c.subject}</p>

                <div className={styles.progressRow}>
                  <span className={styles.progressLabel}>
                    <IconUsers size={12} /> {formatNumber(c.totalRecipients)} destinatários
                  </span>
                  {c.status !== 'draft' && (
                    <>
                      <span className={styles.progressMeta}>
                        {formatNumber(c.sentCount)} enviados
                        {c.failedCount > 0 && (
                          <>
                            {' · '}
                            <span className={styles.failed}>
                              {formatNumber(c.failedCount)} falhas
                            </span>
                          </>
                        )}
                      </span>
                      <div className={styles.progressBar}>
                        <span
                          className={styles.progressFill}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Card>

      {composing && (
        <CampaignComposer
          onClose={() => setComposing(false)}
          onCreated={(c) => {
            setComposing(false);
            setItems((prev) => (prev ? [c, ...prev] : [c]));
          }}
        />
      )}

      <ConfirmDialog
        open={sendingId !== null}
        onClose={() => setSendingId(null)}
        onConfirm={confirmSend}
        title="Disparar esta campanha?"
        description="O envio começa imediatamente. O throttle respeita a quota do Resend, então campanhas grandes podem levar alguns minutos. Você pode acompanhar o progresso aqui."
        confirmLabel="Disparar agora"
      />
    </>
  );
}

/* ── Composer dialog ─────────────────────────────────────────── */

interface ComposerProps {
  onClose: () => void;
  onCreated: (c: EmailCampaign) => void;
}

function CampaignComposer({ onClose, onCreated }: ComposerProps) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [segment, setSegment] = useState<SegmentKind>('all');
  const [topPct, setTopPct] = useState('10');
  const [days, setDays] = useState('30');
  const [city, setCity] = useState('');
  const [emails, setEmails] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);

  function buildParams() {
    switch (segment) {
      case 'superfans':
        return { topPct: Math.max(1, Math.min(100, Number(topPct) || 10)) };
      case 'inactive':
        return { days: Math.max(1, Number(days) || 30) };
      case 'city':
        return { city: city.trim() };
      case 'custom_emails':
        return {
          emails: emails
            .split(/[\n,]/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0),
        };
      default:
        return {};
    }
  }

  async function preview() {
    setPreviewing(true);
    try {
      const res = await emailsService.campaigns.create({
        name: name || '(preview)',
        subject: subject || '(preview)',
        html: html || '(preview)',
        segment,
        segmentParams: buildParams(),
        preview: true,
      });
      if ('count' in res) {
        setPreviewCount(res.count);
      }
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro no preview',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function create() {
    setCreating(true);
    try {
      const res = await emailsService.campaigns.create({
        name: name.trim(),
        subject: subject.trim(),
        html,
        segment,
        segmentParams: buildParams(),
      });
      if ('campaign' in res) {
        push({
          type: 'success',
          title: 'Campanha criada como rascunho',
          description: 'Confira a lista pra disparar quando estiver pronto.',
        });
        onCreated(res.campaign);
      }
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao criar',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setCreating(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    subject.trim().length > 0 &&
    html.trim().length > 0 &&
    (segment !== 'city' || city.trim().length > 0) &&
    (segment !== 'custom_emails' || emails.includes('@'));

  return (
    <Dialog
      open
      onClose={() => (creating ? undefined : onClose())}
      title="Nova campanha"
      description="Envia o mesmo email pra todos os destinatários do segmento. Salva como rascunho — você dispara num segundo passo, evita acidente."
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<IconUsers size={14} />}
            onClick={preview}
            loading={previewing}
          >
            {previewCount !== null
              ? `${formatNumber(previewCount)} destinatários`
              : 'Calcular destinatários'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={create}
            loading={creating}
            disabled={!canSubmit}
          >
            Salvar rascunho
          </Button>
        </>
      }
    >
      <div className={styles.composerBody}>
        <Input
          label="Nome (interno)"
          required
          placeholder="Ex.: Reativação outubro"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Assunto do email"
          required
          placeholder="Ex.: Sentimos sua falta no Fanverse"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <div>
          <label className={styles.paneLabel}>Conteúdo HTML</label>
          <textarea
            className={styles.htmlEditor}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            placeholder="<p>Olá, ...</p>"
          />
        </div>

        <div className={styles.segmentRow}>
          <Select
            label="Segmento"
            inputSize="md"
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value as SegmentKind);
              setPreviewCount(null);
            }}
            options={SEGMENT_OPTIONS}
          />

          {segment === 'superfans' && (
            <Input
              label="Top X%"
              type="number"
              inputSize="md"
              value={topPct}
              onChange={(e) => {
                setTopPct(e.target.value);
                setPreviewCount(null);
              }}
            />
          )}
          {segment === 'inactive' && (
            <Input
              label="Sem login há (dias)"
              type="number"
              inputSize="md"
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setPreviewCount(null);
              }}
            />
          )}
          {segment === 'city' && (
            <Input
              label="Cidade"
              inputSize="md"
              placeholder="Ex.: São Paulo"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPreviewCount(null);
              }}
            />
          )}
        </div>

        {segment === 'custom_emails' && (
          <div>
            <label className={styles.paneLabel}>
              Emails (um por linha ou separados por vírgula)
            </label>
            <textarea
              className={styles.emailList}
              value={emails}
              onChange={(e) => {
                setEmails(e.target.value);
                setPreviewCount(null);
              }}
              placeholder="alice@example.com&#10;bob@example.com"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
