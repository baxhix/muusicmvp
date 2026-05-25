'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { IconCheckCircle, IconTrash, IconPlus } from '@/components/icons';
import { emailsService } from '@/services/emails';
import {
  type BrandSettings,
  type BrandSocialLink,
  type BrandFooterLink,
  designToHtml,
} from '@/services/emailDesign';
import DevicePreview from './DevicePreview';
import styles from './BrandTab.module.css';

const SOCIAL_PLATFORMS: { value: BrandSocialLink['platform']; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter',   label: 'Twitter / X' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'website',   label: 'Website' },
];

/**
 * Tab "Marca" — config global aplicada a TODOS os emails:
 *   - Logo do header (template pode override individualmente)
 *   - Brand footer: site, redes sociais, links institucionais,
 *     endereço legal
 *
 * Layout split: sidebar com form (scroll) + preview ao vivo do
 * email institucional padrão (header com logo + footer da marca).
 */
export default function BrandTab() {
  const { push } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<BrandSettings>({});
  const [saving, setSaving] = useState(false);

  /* Preview usa um template fixo com header + 1 paragraph + 1
   * button — visualização do que vai aparecer em todo email. */
  const previewHtml = renderBrandPreview(settings);

  useEffect(() => {
    let cancel = false;
    emailsService.brand
      .get()
      .then((res) => {
        if (!cancel) {
          setSettings(res.settings ?? {});
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancel) {
          push({
            type: 'error',
            title: 'Erro ao carregar marca',
            description: err instanceof Error ? err.message : '',
          });
          setLoaded(true);
        }
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      await emailsService.brand.upsert(settings);
      push({
        type: 'success',
        title: 'Marca salva',
        description: 'Próximos emails disparados já usam o novo footer e logo.',
      });
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  /* Helpers — funções imutáveis pra editar listas. */
  function updateSocial(i: number, next: BrandSocialLink) {
    const socials = (settings.socials ?? []).map((s, idx) =>
      idx === i ? next : s,
    );
    setSettings({ ...settings, socials });
  }
  function removeSocial(i: number) {
    const socials = (settings.socials ?? []).filter((_, idx) => idx !== i);
    setSettings({ ...settings, socials });
  }
  function addSocial() {
    const socials = [
      ...(settings.socials ?? []),
      { platform: 'instagram', url: 'https://' } as BrandSocialLink,
    ];
    setSettings({ ...settings, socials });
  }
  function updateLink(i: number, next: BrandFooterLink) {
    const links = (settings.links ?? []).map((l, idx) => (idx === i ? next : l));
    setSettings({ ...settings, links });
  }
  function removeLink(i: number) {
    const links = (settings.links ?? []).filter((_, idx) => idx !== i);
    setSettings({ ...settings, links });
  }
  function addLink() {
    const links = [
      ...(settings.links ?? []),
      { label: 'Novo link', url: 'https://' },
    ];
    setSettings({ ...settings, links });
  }

  if (!loaded) {
    return (
      <Card>
        <div className={styles.loading}>Carregando configurações…</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Marca"
        description="Aparência institucional aplicada a TODOS os emails da plataforma: logotipo no cabeçalho + rodapé com redes sociais e links. Cada template pode sobrescrever o logo individualmente."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconCheckCircle size={14} />}
            onClick={save}
            loading={saving}
          >
            Salvar
          </Button>
        }
      />

      <div className={styles.body}>
        {/* ── Form ──────────────────────────────────────────── */}
        <aside className={styles.form}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Identidade</h3>
            <Input
              label="Nome da marca"
              value={settings.brandName ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, brandName: e.target.value })
              }
              placeholder="Fanverse"
              helperText="Aparece no rodapé como nome principal."
            />
            <Input
              label="Logo (URL)"
              value={settings.logoUrl ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, logoUrl: e.target.value })
              }
              placeholder="https://muusic.live/logo.png"
              helperText="Renderizado no cabeçalho de cada email. PNG/SVG com fundo transparente, altura ~40px."
            />
            <Input
              label="Site institucional"
              value={settings.siteUrl ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, siteUrl: e.target.value })
              }
              placeholder="https://muusic.live"
              helperText="Vira link no rodapé com o nome da marca."
            />
          </section>

          {/* ── Redes sociais ─────────────────────────────── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Redes sociais</h3>
              <button
                type="button"
                className={styles.addBtn}
                onClick={addSocial}
              >
                <IconPlus size={12} /> Adicionar
              </button>
            </div>
            {(settings.socials ?? []).length === 0 && (
              <p className={styles.emptyHint}>
                Nenhuma rede adicionada. Clique em &quot;Adicionar&quot; pra incluir.
              </p>
            )}
            {(settings.socials ?? []).map((s, i) => (
              <div key={i} className={styles.socialRow}>
                <Select
                  inputSize="md"
                  value={s.platform}
                  onChange={(e) =>
                    updateSocial(i, { ...s, platform: e.target.value })
                  }
                  options={SOCIAL_PLATFORMS}
                />
                <Input
                  inputSize="md"
                  value={s.url}
                  onChange={(e) => updateSocial(i, { ...s, url: e.target.value })}
                  placeholder="https://"
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeSocial(i)}
                  aria-label="Remover"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </section>

          {/* ── Links institucionais ───────────────────────── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Links no rodapé</h3>
              <button
                type="button"
                className={styles.addBtn}
                onClick={addLink}
              >
                <IconPlus size={12} /> Adicionar
              </button>
            </div>
            {(settings.links ?? []).length === 0 && (
              <p className={styles.emptyHint}>
                Termos, privacidade, ajuda — separados por · no rodapé.
              </p>
            )}
            {(settings.links ?? []).map((l, i) => (
              <div key={i} className={styles.linkRow}>
                <Input
                  inputSize="md"
                  value={l.label}
                  onChange={(e) => updateLink(i, { ...l, label: e.target.value })}
                  placeholder="Termos"
                />
                <Input
                  inputSize="md"
                  value={l.url}
                  onChange={(e) => updateLink(i, { ...l, url: e.target.value })}
                  placeholder="https://"
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeLink(i)}
                  aria-label="Remover"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </section>

          {/* ── Texto legal ───────────────────────────────── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Linhas legais</h3>
            <Input
              label="Endereço / linha legal (opcional)"
              value={settings.addressLine ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, addressLine: e.target.value })
              }
              placeholder="Rua Exemplo 123, São Paulo - SP, 01001-000"
              helperText="Recomendado por CAN-SPAM/LGPD pra reduzir spam score."
            />
            <Input
              label="Copyright (opcional)"
              value={settings.copyrightLine ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, copyrightLine: e.target.value })
              }
              placeholder="© 2026 Fanverse — Todos os direitos reservados"
              helperText="Default: © [ano atual] [nome da marca]."
            />
          </section>

          {/* ── Cores do rodapé ───────────────────────────── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Cores do rodapé</h3>
            <div className={styles.colorGrid}>
              <ColorInput
                label="Fundo"
                value={settings.bgColor ?? '#f6f6f7'}
                onChange={(v) => setSettings({ ...settings, bgColor: v })}
              />
              <ColorInput
                label="Texto"
                value={settings.textColor ?? '#888888'}
                onChange={(v) => setSettings({ ...settings, textColor: v })}
              />
              <ColorInput
                label="Links"
                value={settings.linkColor ?? '#555555'}
                onChange={(v) => setSettings({ ...settings, linkColor: v })}
              />
            </div>
          </section>
        </aside>

        {/* ── Preview ─────────────────────────────────────── */}
        <main className={styles.previewArea}>
          <DevicePreview
            html={previewHtml}
            subject="Exemplo de email com marca aplicada"
          />
        </main>
      </div>
    </Card>
  );
}

/* ── Color input compacto ─────────────────────────────────────── */

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <div className={styles.colorField}>
      <label className={styles.colorLabel}>{label}</label>
      <div className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorPicker}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className={styles.colorText}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

/* ── Preview generator ────────────────────────────────────────── */

/** Renderiza um email exemplo (header + paragraph + button) com o
 *  brand aplicado pra o admin ver como vai ficar. */
function renderBrandPreview(brand: BrandSettings): string {
  return designToHtml(
    {
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
      header: {
        enabled: true,
        title: 'Olá, fã!',
        subtitle: 'Exemplo de email com a marca aplicada.',
      },
      blocks: [
        {
          id: 'pv-1',
          kind: 'paragraph',
          text: 'Este é um trecho de exemplo. O rodapé abaixo aparece automaticamente em todos os emails que a plataforma dispara — magic link, boas-vindas, campanhas, etc.',
        },
        {
          id: 'pv-2',
          kind: 'button',
          text: 'Botão CTA exemplo',
          href: '#',
          align: 'center',
        },
      ],
      footer: {
        enabled: false,
        text: '',
      },
    },
    brand,
  );
}

