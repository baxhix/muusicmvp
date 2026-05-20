'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Switch from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { IconCheck } from '@/components/icons';
import { siteTagsService } from '@/services/siteTags';
import type { SiteTag, SiteTagKind } from '@/types';
import { formatRelative } from '@/lib/format';
import styles from './TagsManager.module.css';

/**
 * Catálogo de tags de rastreamento.
 *
 * Originalmente vivia em `app/(shell)/settings/page.tsx` como o
 * subcomponente `TagsTab` — extraído pra cá per product feedback
 * "leve o item de Tags para [Desenvolvedor]" (porque integrações
 * de pixels casam mais com o domínio de desenvolvedor do que com
 * Configurações de workspace).
 *
 * Mantém o mesmo modelo: cada `TagCatalogEntry` descreve um
 * provider e o `siteTagsService` cuida da persistência. Pra somar
 * um novo provider basta adicionar o entry ao catálogo + cobrir
 * o `SiteTagKind` na schema CHECK do DB + ensinar o
 * `TrackingTags.tsx` do app.
 */

interface TagCatalogEntry {
  kind: SiteTagKind;
  name: string;
  brand: string;
  monogram: string;
  description: string;
  placeholder: string;
  helperText: string;
  docsUrl?: string;
}

const TAG_CATALOG: TagCatalogEntry[] = [
  {
    kind: 'analytics',
    name: 'Google Analytics 4',
    brand: '#E37400',
    monogram: 'GA',
    description: 'Tag de medição (gtag.js). Cole o ID que começa com G-.',
    placeholder: 'G-XXXXXXXXXX',
    helperText: 'ID que começa com "G-" — encontrado em Admin → Streams de dados.',
    docsUrl: 'https://analytics.google.com',
  },
  {
    kind: 'gtm',
    name: 'Google Tag Manager',
    brand: '#246FDB',
    monogram: 'GTM',
    description: 'Container do GTM. Use quando preferir gerenciar tags pela interface do Google.',
    placeholder: 'GTM-XXXXXXX',
    helperText: 'ID que começa com "GTM-".',
    docsUrl: 'https://tagmanager.google.com',
  },
  {
    kind: 'facebook',
    name: 'Meta (Facebook) Pixel',
    brand: '#0866FF',
    monogram: 'fb',
    description: 'Pixel da Meta para campanhas no Facebook e Instagram Ads.',
    placeholder: '1234567890123456',
    helperText: 'ID numérico do pixel — encontrado no Gerenciador de Eventos.',
    docsUrl: 'https://business.facebook.com/events_manager',
  },
  {
    kind: 'clarity',
    name: 'Microsoft Clarity',
    brand: '#0078D4',
    monogram: 'MC',
    description: 'Mapas de calor e gravações de sessão (free, sem amostragem).',
    placeholder: 'xxxxxxxxxx',
    helperText: 'ID do projeto — visível na URL do dashboard, /projects/<ID>.',
    docsUrl: 'https://clarity.microsoft.com',
  },
  {
    kind: 'tiktok',
    name: 'TikTok Pixel',
    brand: '#000000',
    monogram: 'tt',
    description: 'Pixel da TikTok para mensurar campanhas e públicos.',
    placeholder: 'C123ABC456DEF',
    helperText: 'ID do pixel (começa com "C…") — encontrado em TikTok Ads Manager.',
    docsUrl: 'https://ads.tiktok.com',
  },
  {
    kind: 'hotjar',
    name: 'Hotjar',
    brand: '#FD3A5C',
    monogram: 'HJ',
    description: 'Mapas de calor, funis e gravações para análise qualitativa.',
    placeholder: '1234567',
    helperText: 'Site ID numérico (HJID).',
    docsUrl: 'https://insights.hotjar.com',
  },
  {
    kind: 'posthog',
    name: 'PostHog',
    brand: '#1D4AFF',
    monogram: 'PH',
    description: 'Product Analytics (eventos, funis, cohorts, retenção). Ferramenta principal de analytics.',
    placeholder: 'phc_xxxxxxxxxxxxxxxxxxxxxx',
    helperText: 'Project API key — começa com "phc_". Encontrada em Settings → Project no PostHog.',
    docsUrl: 'https://app.posthog.com',
  },
];

export default function TagsManager() {
  const [tags, setTags] = useState<SiteTag[] | null>(null);

  useEffect(() => {
    siteTagsService
      .list()
      .then((res) => setTags(res.items))
      .catch((err) => {
        console.error('siteTags.list failed:', err);
        // Fallback: gera linhas vazias do catálogo pra UI não travar.
        setTags(
          TAG_CATALOG.map((t) => ({
            kind: t.kind,
            value: '',
            enabled: false,
            updatedAt: new Date(0).toISOString(),
            updatedBy: null,
          })),
        );
      });
  }, []);

  function patchLocal(kind: SiteTagKind, patch: Partial<SiteTag>) {
    setTags((prev) =>
      prev ? prev.map((t) => (t.kind === kind ? { ...t, ...patch } : t)) : prev,
    );
  }

  return (
    <Card>
      <CardHeader
        title="Tags de rastreamento"
        description="Pixels e tags de análise injetados em todas as páginas da plataforma. Tudo que estiver ativo aqui carrega automaticamente para os usuários."
      />
      {tags === null ? (
        <div style={{ padding: 24, fontSize: 12.5, color: 'var(--text-mute)' }}>
          Carregando…
        </div>
      ) : (
        <div className={styles.tagGrid}>
          {TAG_CATALOG.map((entry) => {
            const row =
              tags.find((t) => t.kind === entry.kind) ?? {
                kind: entry.kind,
                value: '',
                enabled: false,
                updatedAt: new Date(0).toISOString(),
                updatedBy: null,
              };
            return (
              <TagCard
                key={entry.kind}
                entry={entry}
                row={row}
                onChange={(patch) => patchLocal(entry.kind, patch)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface TagCardProps {
  entry: TagCatalogEntry;
  row: SiteTag;
  onChange: (patch: Partial<SiteTag>) => void;
}

function TagCard({ entry, row, onChange }: TagCardProps) {
  const { push } = useToast();
  const [value, setValue] = useState(row.value);
  const [enabled, setEnabled] = useState(row.enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(row.value);
    setEnabled(row.enabled);
  }, [row.value, row.enabled]);

  const dirty = value !== row.value || enabled !== row.enabled;
  const active = row.enabled && row.value.trim().length > 0;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await siteTagsService.save(entry.kind, value.trim(), enabled);
      onChange({
        value: value.trim(),
        enabled: enabled && value.trim().length > 0,
        updatedAt: new Date().toISOString(),
      });
      push({
        type: 'success',
        title: `${entry.name} salvo`,
        description: enabled && value.trim()
          ? 'A tag passa a carregar no próximo refresh dos visitantes.'
          : 'A tag foi pausada e não vai mais carregar.',
      });
    } catch (err) {
      console.error('siteTag save failed:', err);
      push({
        type: 'error',
        title: `Falha ao salvar ${entry.name}`,
        description: 'Tente novamente em alguns instantes.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.tagCard} ${active ? styles.tagCardActive : ''}`}>
      <div className={styles.tagHead}>
        <div className={styles.tagHeadLeft}>
          <span
            className={styles.tagLogo}
            style={{ background: entry.brand }}
            aria-hidden="true"
          >
            {entry.monogram}
          </span>
          <div className={styles.tagMeta}>
            <span className={styles.tagName}>{entry.name}</span>
            <span className={styles.tagDescription}>{entry.description}</span>
          </div>
        </div>
        <Switch
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={saving}
          aria-label={`Ativar ${entry.name}`}
        />
      </div>

      <Input
        inputSize="md"
        placeholder={entry.placeholder}
        helperText={entry.helperText}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        maxLength={200}
      />

      <div className={styles.tagFooter}>
        <span className={styles.tagFooterMeta}>
          {row.updatedBy
            ? `Editado ${formatRelative(row.updatedAt)} por ${row.updatedBy.name ?? row.updatedBy.email}`
            : entry.docsUrl
              ? (
                <a
                  href={entry.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--text-mute)', textDecoration: 'underline' }}
                >
                  Onde encontrar?
                </a>
              )
              : 'Nunca configurado'}
        </span>
        <Button
          variant={dirty ? 'primary' : 'ghost'}
          size="sm"
          loading={saving}
          disabled={!dirty || saving}
          onClick={save}
          leadingIcon={!saving && dirty ? <IconCheck size={14} /> : undefined}
        >
          {dirty ? 'Salvar' : active ? 'Ativo' : 'Inativo'}
        </Button>
      </div>
    </div>
  );
}
