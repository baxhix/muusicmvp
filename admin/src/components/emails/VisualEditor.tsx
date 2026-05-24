'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import {
  type EmailDesign,
  type EmailBlock,
  type BlockKind,
  type EmailTheme,
  newBlockId,
} from '@/services/emailDesign';
import styles from './VisualEditor.module.css';

interface VisualEditorProps {
  value: EmailDesign;
  onChange: (design: EmailDesign) => void;
}

/**
 * Editor visual de templates — form-based.
 *
 * Estrutura:
 *   - Acordeão "Tema" (cores + fonte do CTA)
 *   - Acordeão "Cabeçalho" (toggle + título + subtítulo)
 *   - Lista de blocos do corpo (reordenável via ↑↓, deletável)
 *   - Acordeão "Rodapé" (toggle + texto)
 *
 * Decisões:
 *   - Sem drag-and-drop por enquanto (overhead alto vs ROI; ↑↓
 *     resolve 99% dos casos).
 *   - Cada bloco tem renderer próprio (HeadingEditor, ButtonEditor
 *     etc.) — adicionar novo block type = adicionar um renderer e
 *     extender o discriminated union.
 */
export default function VisualEditor({ value, onChange }: VisualEditorProps) {
  return (
    <div className={styles.wrap}>
      <ThemeSection
        theme={value.theme}
        onChange={(theme) => onChange({ ...value, theme })}
      />

      <HeaderSection
        header={value.header}
        onChange={(header) => onChange({ ...value, header })}
      />

      <BlocksSection
        blocks={value.blocks}
        onChange={(blocks) => onChange({ ...value, blocks })}
      />

      <FooterSection
        footer={value.footer}
        onChange={(footer) => onChange({ ...value, footer })}
      />
    </div>
  );
}

/* ── Theme ───────────────────────────────────────────────────── */

interface ThemeSectionProps {
  theme: EmailTheme;
  onChange: (theme: EmailTheme) => void;
}

function ThemeSection({ theme, onChange }: ThemeSectionProps) {
  return (
    <Accordion title="Tema (cores e fonte)">
      <div className={styles.themeGrid}>
        <ColorField
          label="Fundo da página"
          help="A cor visível atrás do email (canvas do Gmail/Outlook)."
          value={theme.bgColor}
          onChange={(v) => onChange({ ...theme, bgColor: v })}
        />
        <ColorField
          label="Fundo do conteúdo"
          help="O card centralizado onde fica o texto."
          value={theme.contentBg}
          onChange={(v) => onChange({ ...theme, contentBg: v })}
        />
        <ColorField
          label="Cor do texto principal"
          help="Títulos, parágrafos."
          value={theme.textColor}
          onChange={(v) => onChange({ ...theme, textColor: v })}
        />
        <ColorField
          label="Cor do texto suave"
          help="Subtítulos, rodapé."
          value={theme.mutedColor}
          onChange={(v) => onChange({ ...theme, mutedColor: v })}
        />
        <ColorField
          label="Cor dos links"
          help="URLs dentro de parágrafos."
          value={theme.linkColor}
          onChange={(v) => onChange({ ...theme, linkColor: v })}
        />
        <ColorField
          label="Fundo do botão CTA"
          value={theme.buttonBg}
          onChange={(v) => onChange({ ...theme, buttonBg: v })}
        />
        <ColorField
          label="Texto do botão CTA"
          value={theme.buttonText}
          onChange={(v) => onChange({ ...theme, buttonText: v })}
        />
        <Input
          label="Arredondamento do botão"
          type="number"
          inputSize="md"
          value={String(theme.buttonRadius)}
          onChange={(e) =>
            onChange({ ...theme, buttonRadius: Number(e.target.value) || 0 })
          }
          helperText="Em pixels. 999 = totalmente arredondado."
        />
      </div>
    </Accordion>
  );
}

/* ── Header ──────────────────────────────────────────────────── */

interface HeaderSectionProps {
  header: EmailDesign['header'];
  onChange: (h: EmailDesign['header']) => void;
}

function HeaderSection({ header, onChange }: HeaderSectionProps) {
  return (
    <Accordion title="Cabeçalho">
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={header.enabled}
          onChange={(e) => onChange({ ...header, enabled: e.target.checked })}
        />
        <span>Mostrar cabeçalho com título</span>
      </label>

      {header.enabled && (
        <>
          <Input
            label="Título"
            value={header.title}
            onChange={(e) => onChange({ ...header, title: e.target.value })}
            helperText="Aparece no topo do email como h1 grande."
          />
          <Input
            label="Subtítulo (opcional)"
            value={header.subtitle ?? ''}
            onChange={(e) =>
              onChange({ ...header, subtitle: e.target.value })
            }
            helperText="Texto menor logo abaixo do título."
          />
        </>
      )}
    </Accordion>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */

interface FooterSectionProps {
  footer: EmailDesign['footer'];
  onChange: (f: EmailDesign['footer']) => void;
}

function FooterSection({ footer, onChange }: FooterSectionProps) {
  return (
    <Accordion title="Rodapé">
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={footer.enabled}
          onChange={(e) => onChange({ ...footer, enabled: e.target.checked })}
        />
        <span>Mostrar rodapé</span>
      </label>

      {footer.enabled && (
        <Input
          label="Texto do rodapé"
          value={footer.text}
          onChange={(e) => onChange({ ...footer, text: e.target.value })}
          helperText="Geralmente um aviso curto (ex.: 'Se você não pediu, ignore')."
        />
      )}
    </Accordion>
  );
}

/* ── Blocks ──────────────────────────────────────────────────── */

interface BlocksSectionProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}

const ADD_OPTIONS: { value: BlockKind; label: string }[] = [
  { value: 'paragraph', label: 'Parágrafo' },
  { value: 'heading',   label: 'Subtítulo' },
  { value: 'button',    label: 'Botão (CTA)' },
  { value: 'image',     label: 'Imagem' },
  { value: 'divider',   label: 'Linha divisória' },
  { value: 'spacer',    label: 'Espaço em branco' },
];

function makeBlock(kind: BlockKind): EmailBlock {
  const id = newBlockId();
  switch (kind) {
    case 'paragraph': return { id, kind, text: 'Novo parágrafo.' };
    case 'heading':   return { id, kind, text: 'Subtítulo', level: 2 };
    case 'button':    return { id, kind, text: 'Clique aqui', href: 'https://', align: 'center' };
    case 'image':     return { id, kind, src: 'https://', alt: '' };
    case 'divider':   return { id, kind };
    case 'spacer':    return { id, kind, height: 16 };
  }
}

function BlocksSection({ blocks, onChange }: BlocksSectionProps) {
  const [addKind, setAddKind] = useState<BlockKind>('paragraph');

  function update(index: number, next: EmailBlock) {
    onChange(blocks.map((b, i) => (i === index ? next : b)));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...blocks, makeBlock(addKind)]);
  }

  return (
    <Accordion title={`Conteúdo (${blocks.length} ${blocks.length === 1 ? 'bloco' : 'blocos'})`} defaultOpen>
      <div className={styles.blocksList}>
        {blocks.map((block, i) => (
          <BlockEditor
            key={block.id}
            block={block}
            onChange={(next) => update(i, next)}
            onMoveUp={i > 0 ? () => move(i, -1) : undefined}
            onMoveDown={i < blocks.length - 1 ? () => move(i, 1) : undefined}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      <div className={styles.addRow}>
        <Select
          inputSize="md"
          value={addKind}
          onChange={(e) => setAddKind(e.target.value as BlockKind)}
          options={ADD_OPTIONS}
        />
        <Button variant="outline" size="sm" onClick={add}>
          + Adicionar
        </Button>
      </div>
    </Accordion>
  );
}

/* ── BlockEditor (dispatcher) ──────────────────────────────────── */

interface BlockEditorProps {
  block: EmailBlock;
  onChange: (b: EmailBlock) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
}

function BlockEditor({
  block,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: BlockEditorProps) {
  return (
    <div className={styles.blockCard}>
      <header className={styles.blockHeader}>
        <span className={styles.blockKind}>{blockLabel(block.kind)}</span>
        <div className={styles.blockActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMoveUp}
            disabled={!onMoveUp}
            aria-label="Mover pra cima"
            title="Mover pra cima"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMoveDown}
            disabled={!onMoveDown}
            aria-label="Mover pra baixo"
            title="Mover pra baixo"
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={onRemove}
            aria-label="Remover bloco"
            title="Remover"
          >
            ×
          </button>
        </div>
      </header>

      <div className={styles.blockBody}>
        {block.kind === 'heading' && (
          <>
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              placeholder="Texto do subtítulo"
            />
            <Select
              inputSize="md"
              value={String(block.level ?? 2)}
              onChange={(e) =>
                onChange({ ...block, level: Number(e.target.value) as 2 | 3 })
              }
              options={[
                { value: '2', label: 'H2 (médio)' },
                { value: '3', label: 'H3 (pequeno)' },
              ]}
            />
          </>
        )}

        {block.kind === 'paragraph' && (
          <textarea
            className={styles.textarea}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Texto do parágrafo. Use {{magicUrl}} pra variáveis."
            rows={3}
          />
        )}

        {block.kind === 'button' && (
          <>
            <Input
              label="Texto do botão"
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
            <Input
              label="URL (ou {{variável}})"
              value={block.href}
              onChange={(e) => onChange({ ...block, href: e.target.value })}
              helperText="Ex.: https://muusic.live/algo OU {{magicUrl}}"
            />
            <Select
              label="Alinhamento"
              inputSize="md"
              value={block.align ?? 'center'}
              onChange={(e) =>
                onChange({
                  ...block,
                  align: e.target.value as 'center' | 'left',
                })
              }
              options={[
                { value: 'center', label: 'Centro' },
                { value: 'left',   label: 'Esquerda' },
              ]}
            />
          </>
        )}

        {block.kind === 'image' && (
          <>
            <Input
              label="URL da imagem"
              value={block.src}
              onChange={(e) => onChange({ ...block, src: e.target.value })}
              placeholder="https://"
            />
            <Input
              label="Alt (descrição p/ acessibilidade)"
              value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
            />
            <Input
              label="Largura máxima (px)"
              type="number"
              value={String(block.width ?? 480)}
              onChange={(e) =>
                onChange({ ...block, width: Number(e.target.value) || 480 })
              }
            />
          </>
        )}

        {block.kind === 'divider' && (
          <p className={styles.blockHint}>
            Uma linha horizontal sutil. Sem opções.
          </p>
        )}

        {block.kind === 'spacer' && (
          <Input
            label="Altura (px)"
            type="number"
            value={String(block.height ?? 16)}
            onChange={(e) =>
              onChange({ ...block, height: Number(e.target.value) || 16 })
            }
            helperText="Espaço em branco vertical. Ex.: 24 pra um respiro mais aberto."
          />
        )}
      </div>
    </div>
  );
}

function blockLabel(kind: BlockKind): string {
  switch (kind) {
    case 'heading':   return 'Subtítulo';
    case 'paragraph': return 'Parágrafo';
    case 'button':    return 'Botão (CTA)';
    case 'image':     return 'Imagem';
    case 'divider':   return 'Linha divisória';
    case 'spacer':    return 'Espaço';
  }
}

/* ── Building blocks ─────────────────────────────────────────── */

interface ColorFieldProps {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, help, value, onChange }: ColorFieldProps) {
  return (
    <div className={styles.colorField}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorPicker}
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <input
          type="text"
          className={styles.colorText}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
      {help && <p className={styles.fieldHelp}>{help}</p>}
    </div>
  );
}

/** O input type="color" só aceita #RRGGBB válido. Se o admin
 *  digita algo invalido no text field, o picker fica vazio até
 *  voltar a um valor válido — esse helper evita o warning de
 *  React sobre value inválido. */
function normalizeHex(v: string): string {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
}

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Accordion({ title, defaultOpen, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <section className={styles.accordion}>
      <button
        type="button"
        className={styles.accordionHeader}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={styles.chev}>{open ? '−' : '+'}</span>
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </section>
  );
}
