'use client';

/**
 * Design System — documentação VIVA do painel admin.
 *
 * Esta página NÃO cria componentes novos. Ela importa e renderiza
 * os componentes REAIS de `@/components/ui` + os tokens REAIS de
 * `globals.css`, organizados nas categorias pedidas pelo produto:
 *
 *   Foundations · Componentes · Navegação · Feedback · Data Display
 *   + Auditoria de consistência
 *
 * Cada bloco documenta: nome, categoria, propósito, render vivo do
 * estado atual, onde é usado, variações, props visuais e
 * observações de inconsistência. Serve de referência central pra
 * designers + devs e de base pra padronização futura.
 *
 * Regra de ouro deste arquivo: zero cor/medida hardcoded fora dos
 * próprios swatches (que existem justamente pra MOSTRAR o token).
 */

import { useState, type ReactNode } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import Switch from '@/components/ui/Switch';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar, { AvatarGroup } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import dynamic from 'next/dynamic';
import EmptyState, { LoadingState } from '@/components/ui/EmptyState';
import Table, { type Column } from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import * as Icons from '@/components/icons';
import {
  IconUsers,
  IconStar,
  IconActivity,
  IconPlus,
  IconSearch,
  IconSettings,
} from '@/components/icons';
import styles from './page.module.css';

/* Lazy load: os modais só são baixados quando o usuário abre um —
 * cada um vira um chunk separado, fora do bundle inicial da página
 * (next/dynamic). Padrão recomendado pra qualquer surface gated por
 * interação no admin. */
const Dialog = dynamic(() => import('@/components/ui/Dialog'), { ssr: false });
const ConfirmDialog = dynamic(
  () => import('@/components/ui/Dialog').then((m) => m.ConfirmDialog),
  { ssr: false }
);
const Drawer = dynamic(() => import('@/components/ui/Drawer'), { ssr: false });

/* ════════════════════════════════════════════════════════════
   Helpers de layout DESTA página (não são componentes do DS).
   ════════════════════════════════════════════════════════════ */

type MetaRow = [string, ReactNode];

function Meta({ rows }: { rows: MetaRow[] }) {
  return (
    <dl className={styles.meta}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt className={styles.metaKey}>{k}</dt>
          <dd className={styles.metaVal} style={{ margin: 0 }}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Spec({
  name,
  category,
  description,
  stageCol,
  children,
  meta,
}: {
  name: string;
  category: string;
  description: ReactNode;
  stageCol?: boolean;
  children: ReactNode;
  meta: MetaRow[];
}) {
  return (
    <Card>
      <CardHeader
        title={name}
        description={description}
        actions={
          <Badge tone="brand" size="sm">
            {category}
          </Badge>
        }
      />
      <CardBody>
        <div className={styles.spec}>
          <div className={`${styles.stage} ${stageCol ? styles.stageCol : ''}`}>
            {children}
          </div>
          <Meta rows={meta} />
        </div>
      </CardBody>
    </Card>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.cell}>
      <span className={styles.cellLabel}>{label}</span>
      {children}
    </div>
  );
}

function code(s: string) {
  return <code className={styles.code}>{s}</code>;
}

/* ════════════════════════════════════════════════════════════
   FOUNDATIONS
   ════════════════════════════════════════════════════════════ */

const COLOR_GROUPS: { title: string; hint: string; tokens: string[] }[] = [
  {
    title: 'Superfícies',
    hint: 'Fundo da app, cards e camadas elevadas',
    tokens: ['--bg', '--bg-subtle', '--surface', '--surface-2', '--surface-3', '--surface-hover'],
  },
  {
    title: 'Texto',
    hint: 'Hierarquia tipográfica por opacidade/cor',
    tokens: ['--text', '--text-soft', '--text-mute', '--text-faint'],
  },
  {
    title: 'Bordas & overlay',
    hint: 'Divisores, contornos e véu de modais',
    tokens: ['--border', '--border-soft', '--border-strong', '--overlay'],
  },
  {
    title: 'Accent',
    hint: 'Cor neutra de ênfase (botão primário, foco)',
    tokens: ['--accent', '--accent-soft', '--accent-line', '--accent-fg'],
  },
];

const SEMANTIC_TONES = ['brand', 'info', 'success', 'warning', 'danger', 'neutral'] as const;

const SPACING: [string, string][] = [
  ['--s-1', '4px'],
  ['--s-2', '8px'],
  ['--s-3', '12px'],
  ['--s-4', '16px'],
  ['--s-5', '20px'],
  ['--s-6', '24px'],
  ['--s-8', '32px'],
  ['--s-10', '40px'],
  ['--s-12', '48px'],
  ['--s-16', '64px'],
];

const RADII: [string, string][] = [
  ['--r-xs', '4px'],
  ['--r-sm', '6px'],
  ['--r-md', '8px'],
  ['--r-lg', '10px'],
  ['--r-xl', '14px'],
  ['--r-2xl', '20px'],
  ['--r-full', '9999px'],
];

const SHADOWS = ['--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-pop'];

const TYPE_SCALE: { token: string; px: string; weight: number; label: string }[] = [
  { token: '--text-2xl', px: '24px', weight: 700, label: 'Display / número de KPI' },
  { token: '--text-xl', px: '20px', weight: 600, label: 'Título de página' },
  { token: '--text-lg', px: '16px', weight: 600, label: 'Título de card / seção' },
  { token: '--text-base', px: '14px', weight: 400, label: 'Corpo — inputs, tabelas' },
  { token: '--text-sm', px: '12.5px', weight: 400, label: 'Auxiliar (helper)' },
  { token: '--text-xs', px: '11px', weight: 600, label: 'Caption / eyebrow' },
];

const MOTION_TOKENS: [string, string][] = [
  ['--dur-fast', '120ms'],
  ['--dur-base', '180ms'],
  ['--dur-slow', '280ms'],
  ['--ease-out', 'saídas / entradas de UI'],
  ['--ease-in-out', 'loops e transições simétricas'],
];

const Z_TOKENS: [string, string][] = [
  ['--z-sidebar', '30'],
  ['--z-topbar', '40'],
  ['--z-drawer', '60'],
  ['--z-dialog', '70'],
  ['--z-toast', '80'],
];

const LAYOUT_TOKENS: [string, string][] = [
  ['--content-max', '1280px — largura máxima do conteúdo'],
  ['--sidebar-w', '248px — sidebar expandida'],
  ['--sidebar-w-collapsed', '76px — sidebar recolhida'],
  ['--topbar-h', '56px — altura da barra superior'],
];

function TokenTable({ rows }: { rows: [string, string][] }) {
  return (
    <Meta rows={rows.map(([k, v]) => [k, v] as MetaRow)} />
  );
}

function FoundationsSection() {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        As bases visuais do admin. Todos os componentes consomem estes tokens
        ({code('globals.css')}) — alterá-los aqui reflete em todo o painel.
        Tema escuro é o padrão; o claro espelha cada variável em{' '}
        {code("[data-theme='light']")}.
      </p>

      {/* CORES */}
      <Spec
        name="Cores"
        category="Foundations"
        description="Paleta semântica em CSS custom properties. Cada cor tem variantes base / soft (fundo) / line (borda)."
        stageCol
        meta={[
          ['Onde é usado', 'Toda a UI — superfícies, texto, estados e badges'],
          ['Variações', 'base · soft · line · fg (accent / danger)'],
          ['Tema', 'dark (padrão) + light espelhado'],
          ['Observações', 'Mesclados: --neutral=--text-soft, --accent=--text, --surface-hover=--surface-3. Novo --danger-fg (ver Auditoria)'],
        ]}
      >
        {COLOR_GROUPS.map((g) => (
          <div key={g.title} style={{ width: '100%' }}>
            <span className={styles.cellLabel}>{g.title}</span>
            <div className={styles.swatchGrid} style={{ marginTop: 8 }}>
              {g.tokens.map((t) => (
                <div key={t} className={styles.swatch}>
                  <div className={styles.swatchBox} style={{ background: `var(${t})` }} />
                  <span className={styles.swatchName}>{t}</span>
                  <span className={styles.swatchHint}>{g.hint}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ width: '100%' }}>
          <span className={styles.cellLabel}>Semânticas (base · soft · line)</span>
          <div className={styles.swatchGrid} style={{ marginTop: 8 }}>
            {SEMANTIC_TONES.map((tone) => (
              <div key={tone} className={styles.swatch}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div
                    className={styles.swatchBox}
                    style={{ background: `var(--${tone})`, flex: 2 }}
                  />
                  <div
                    className={styles.swatchBox}
                    style={{ background: `var(--${tone}-soft)`, flex: 1 }}
                  />
                  <div
                    className={styles.swatchBox}
                    style={{ background: `var(--${tone}-line)`, flex: 1 }}
                  />
                </div>
                <span className={styles.swatchName}>--{tone}</span>
              </div>
            ))}
          </div>
        </div>
      </Spec>

      {/* TIPOGRAFIA */}
      <Spec
        name="Tipografia"
        category="Foundations"
        description="Família Inter (via next/font) para a interface e fonte mono para tokens/código. Pesos 400–700."
        stageCol
        meta={[
          ['Família', <>Inter ({code('--font-sans')}) · mono ({code('--font-mono')})</>],
          ['Onde é usado', 'Toda a tipografia do painel'],
          ['Escala', <>tokenizada em {code('--text-xs')} … {code('--text-2xl')} (amostras abaixo renderizam direto dos tokens)</>],
          ['Observações', 'Tokens criados; adoção nos componentes é gradual (alguns ainda usam px literal)'],
        ]}
      >
        {TYPE_SCALE.map((t) => (
          <div key={t.token} className={styles.typeRow} style={{ width: '100%' }}>
            <span className={styles.typeTok}>
              {t.token} · {t.px}
            </span>
            <span style={{ fontSize: `var(${t.token})`, fontWeight: t.weight, color: 'var(--text)' }}>
              {t.label}
            </span>
          </div>
        ))}
      </Spec>

      {/* ESPAÇAMENTOS */}
      <Spec
        name="Espaçamentos"
        category="Foundations"
        description="Escala de espaçamento em passos de 4px. Usada em padding, gap e margens."
        stageCol
        meta={[
          ['Onde é usado', 'gaps de layout, padding de cards, formulários'],
          ['Base', 'múltiplos de 4px (--s-1 = 4 … --s-16 = 64)'],
        ]}
      >
        {SPACING.map(([tok, px]) => (
          <div key={tok} className={styles.spaceRow} style={{ width: '100%' }}>
            <span className={styles.spaceTok}>
              {tok} · {px}
            </span>
            <span className={styles.spaceBar} style={{ width: `var(${tok})` }} />
          </div>
        ))}
      </Spec>

      {/* BORDER RADIUS */}
      <Spec
        name="Border Radius"
        category="Foundations"
        description="Raios de canto, de inputs (sm/md) a pills (full)."
        meta={[
          ['Onde é usado', 'inputs, cards, badges, botões, avatares'],
          ['Variações', '7 níveis: xs → 2xl + full'],
        ]}
      >
        {RADII.map(([tok, px]) => (
          <div
            key={tok}
            className={styles.radiusBox}
            style={{ borderRadius: `var(${tok})` }}
          >
            {tok.replace('--r-', '')} · {px}
          </div>
        ))}
      </Spec>

      {/* SOMBRAS */}
      <Spec
        name="Sombras"
        category="Foundations"
        description="Elevação por camada — de hairline (xs) a popovers/menus (pop)."
        meta={[
          ['Onde é usado', 'cards elevados, dialogs, drawers, dropdowns, toasts'],
          ['Variações', 'xs · sm · md · lg · pop'],
        ]}
      >
        {SHADOWS.map((tok) => (
          <div key={tok} className={styles.shadowBox} style={{ boxShadow: `var(${tok})` }}>
            {tok.replace('--shadow-', '')}
          </div>
        ))}
      </Spec>

      {/* GRID & LAYOUT */}
      <Spec
        name="Grid e Layout"
        category="Foundations"
        description="Dimensões estruturais do shell do admin (sidebar + topbar + conteúdo centralizado)."
        stageCol
        meta={[
          ['Onde é usado', <>{code('(shell)/layout.tsx')}, Sidebar, TopBar, PageHeader</>],
          ['Observações', 'Conteúdo centraliza em --content-max com padding 24px; PageHeader replica a mesma geometria pra alinhar título e corpo'],
        ]}
      >
        <TokenTable rows={LAYOUT_TOKENS} />
      </Spec>

      {/* TOKENS VISUAIS (motion + z) */}
      <Spec
        name="Tokens visuais"
        category="Foundations"
        description="Movimento (durações + curvas) e camadas de empilhamento (z-index)."
        stageCol
        meta={[
          ['Onde é usado', 'transições de UI, ordem de sobreposição (sidebar < topbar < drawer < dialog < toast)'],
        ]}
      >
        <div style={{ width: '100%' }}>
          <span className={styles.cellLabel}>Movimento</span>
          <div style={{ marginTop: 8 }}>
            <TokenTable rows={MOTION_TOKENS} />
          </div>
        </div>
        <div style={{ width: '100%' }}>
          <span className={styles.cellLabel}>Camadas (z-index)</span>
          <div style={{ marginTop: 8 }}>
            <TokenTable rows={Z_TOKENS} />
          </div>
        </div>
      </Spec>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPONENTES
   ════════════════════════════════════════════════════════════ */

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'outline', 'danger', 'dangerGhost'] as const;
const BADGE_TONES = ['neutral', 'brand', 'info', 'success', 'warning', 'danger', 'solid'] as const;
const SELECT_OPTIONS = [
  { value: 'a', label: 'Opção A' },
  { value: 'b', label: 'Opção B' },
  { value: 'c', label: 'Opção C' },
];

const ICON_NAMES: (keyof typeof Icons)[] = [
  'IconDashboard', 'IconFeed', 'IconUsers', 'IconActivity', 'IconShield', 'IconStar',
  'IconSettings', 'IconSearch', 'IconBell', 'IconSun', 'IconMoon', 'IconMonitor',
  'IconCheck', 'IconX', 'IconChevronDown', 'IconChevronRight', 'IconChevronLeft',
  'IconArrowUp', 'IconArrowDown', 'IconArrowRight', 'IconTrendingUp', 'IconTrendingDown',
  'IconPlus', 'IconMinus', 'IconMore', 'IconFilter', 'IconDownload', 'IconUpload',
  'IconTrash', 'IconEdit', 'IconEye', 'IconEyeOff', 'IconAlert', 'IconInfo',
  'IconCheckCircle', 'IconLogout', 'IconFlag', 'IconBan', 'IconMail', 'IconSend',
  'IconRefresh', 'IconHeart', 'IconMessage', 'IconMusic', 'IconImage', 'IconVideo',
  'IconCalendar', 'IconKey', 'IconLink', 'IconCopy', 'IconLoader', 'IconCode',
  'IconTicket', 'IconArchive', 'IconFolder', 'IconHome', 'IconFile', 'IconGrid', 'IconList',
];

function ComponentesSection() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);

  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Os primitivos de interface em {code('@/components/ui')}. Renderizados aqui
        ao vivo, no estado atual do código. Estados de{' '}
        <strong>hover / active / focus</strong> são pseudo-classes CSS — interaja
        com cada exemplo pra vê-los.
      </p>

      {/* BOTÕES */}
      <Spec
        name="Botões"
        category="Componentes"
        description="Ação primária. 6 variantes × 3 tamanhos, com ícones, loading, sucesso e icon-only. Multi-state animado + press tátil via Motion."
        stageCol
        meta={[
          ['Componente', code('Button')],
          ['Onde é usado', 'praticamente toda página — toolbars, formulários, dialogs'],
          ['Variações', '6 variantes · 3 tamanhos (sm 28 / md 34 / lg 40) · iconOnly · leading/trailingIcon'],
          ['Props', <>{code('variant')} {code('size')} {code('loading')} {code('success')} {code('disabled')} {code('iconOnly')}</>],
          ['Motion', <>multi-state {code('idle → loading → success')} (spring pop) + press {code('scale(0.97)')}; respeita reduced-motion</>],
          ['Observações', <>Variante danger usa o token {code('--danger-fg')} (antes #FFFFFF fixo)</>],
        ]}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>
          {BUTTON_VARIANTS.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, width: '100%', alignItems: 'center' }}>
          <Cell label="Tamanhos">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button size="sm">sm</Button>
              <Button size="md">md</Button>
              <Button size="lg">lg</Button>
            </div>
          </Cell>
          <Cell label="Com ícone">
            <Button leadingIcon={<IconPlus size={15} />}>Novo</Button>
          </Cell>
          <Cell label="Icon-only">
            <Button iconOnly aria-label="Configurações">
              <IconSettings size={16} />
            </Button>
          </Cell>
          <Cell label="Loading">
            <Button loading>Salvando</Button>
          </Cell>
          <Cell label="Sucesso">
            <Button variant="primary" success>Salvo</Button>
          </Cell>
          <Cell label="Disabled">
            <Button disabled>Indisponível</Button>
          </Cell>
        </div>
      </Spec>

      {/* INPUTS */}
      <Spec
        name="Inputs"
        category="Componentes"
        description="Campo de texto com label, helper, erro, ícones e 3 tamanhos."
        stageCol
        meta={[
          ['Componente', code('Input')],
          ['Onde é usado', 'formulários de CRUD (blog, FAQ, LGPD, onboarding…)'],
          ['Variações', 'inputSize sm/md/lg · leading/trailingIcon · invalid'],
          ['Estados', 'default · focus · disabled · error'],
        ]}
      >
        <Input label="Default" placeholder="Digite algo" helperText="Texto de apoio" />
        <Input label="Com ícone" placeholder="Buscar" leadingIcon={<IconSearch size={15} />} />
        <Input label="Erro" defaultValue="valor inválido" errorText="Campo obrigatório" />
        <Input label="Disabled" placeholder="Bloqueado" disabled />
      </Spec>

      {/* TEXTAREAS */}
      <Spec
        name="Textareas"
        category="Componentes"
        description="Texto multilinha. Mesma anatomia do Input (label/helper/erro)."
        stageCol
        meta={[
          ['Componente', code('Textarea')],
          ['Onde é usado', 'descrições, conteúdo de posts, respostas de FAQ'],
          ['Estados', 'default · error · disabled'],
        ]}
      >
        <Textarea label="Mensagem" placeholder="Escreva aqui…" helperText="Máx. 500 caracteres" rows={3} />
        <Textarea label="Com erro" errorText="Não pode ficar vazio" rows={3} />
      </Spec>

      {/* SELECTS */}
      <Spec
        name="Selects"
        category="Componentes"
        description="Seleção única nativa com chevron customizado. Mesma moldura visual do Input."
        stageCol
        meta={[
          ['Componente', code('Select')],
          ['Onde é usado', 'filtros, escolha de categoria/autor/status'],
          ['Props', <>{code('options')} {code('placeholder')} {code('inputSize')} {code('invalid')}</>],
        ]}
      >
        <Select label="Categoria" options={SELECT_OPTIONS} placeholder="Selecione…" />
        <Select label="Disabled" options={SELECT_OPTIONS} defaultValue="a" disabled />
      </Spec>

      {/* CHECKBOXES + RADIO + SWITCHES */}
      <Spec
        name="Checkboxes, Radios e Switches"
        category="Componentes"
        description="Controles booleanos. Checkbox suporta estado indeterminado; Switch é o toggle on/off."
        meta={[
          ['Componentes', <>{code('Checkbox')} · {code('Switch')}</>],
          ['Onde é usado', 'seleção em massa em tabelas, toggles de configuração'],
          ['Variações', 'Checkbox: default · checked · indeterminate · disabled — Switch: on/off · disabled'],
          ['Observações', 'NÃO existe primitivo Radio — quando é seleção única usa-se Select ou botões. Gap registrado na Auditoria'],
        ]}
      >
        <Cell label="Checkbox">
          <Checkbox label="Marcado" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        </Cell>
        <Cell label="Indeterminate">
          <Checkbox label="Parcial" indeterminate />
        </Cell>
        <Cell label="Disabled">
          <Checkbox label="Bloqueado" disabled />
        </Cell>
        <Cell label="Switch">
          <Switch label="Ativo" checked={on} onChange={(e) => setOn(e.target.checked)} />
        </Cell>
        <Cell label="Switch off / disabled">
          <Switch label="Desligado" disabled />
        </Cell>
      </Spec>

      {/* UPLOADS */}
      <Spec
        name="Uploads"
        category="Componentes"
        description="Não há primitivo de upload no DS. As páginas (Materiais, Blog, Autores) montam dropzones/uploaders ad-hoc com input file + IconUpload."
        meta={[
          ['Status', 'padrão ad-hoc — NÃO é componente'],
          ['Onde é usado', 'Materiais (dropzone), Blog/Autores (uploader de imagem)'],
          ['Observações', 'Candidato a virar componente FileUpload reutilizável (ver Auditoria)'],
        ]}
      >
        <div className={styles.adhocBanner} style={{ background: 'var(--surface-3)', border: '1px dashed var(--border-strong)', color: 'var(--text-soft)' }}>
          <Icons.IconUpload size={18} /> Arraste arquivos ou clique para enviar (reprodução do padrão ad-hoc)
        </div>
      </Spec>

      {/* TOOLTIPS */}
      <Spec
        name="Tooltips"
        category="Componentes"
        description="Dica contextual no hover/focus de um elemento. 4 lados, com delay."
        meta={[
          ['Componente', code('Tooltip')],
          ['Onde é usado', 'ícones-ação, botões iconOnly, abreviações'],
          ['Props', <>{code('label')} {code('side')} {code('delay')} {code('disabled')}</>],
        ]}
      >
        <Tooltip label="Aparece no topo" side="top">
          <Button iconOnly aria-label="Info"><IconInfoSafe /></Button>
        </Tooltip>
        <Tooltip label="À direita" side="right">
          <Button>Hover me</Button>
        </Tooltip>
      </Spec>

      {/* BADGES + CHIPS */}
      <Spec
        name="Badges e Chips"
        category="Componentes"
        description="Rótulo compacto de status/contagem. 7 tons × 3 tamanhos, com dot opcional. Cobre também o papel de 'chip'."
        stageCol
        meta={[
          ['Componente', code('Badge')],
          ['Onde é usado', 'status em tabelas, contadores, tags'],
          ['Variações', '7 tons · 3 tamanhos · dot'],
          ['Observações', 'Não há primitivo Chip separado — Badge cobre o caso. Sem borda por padrão (só fill + cor)'],
        ]}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%', alignItems: 'center' }}>
          {BADGE_TONES.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
          <Badge size="sm" tone="info">sm</Badge>
          <Badge size="md" tone="info">md</Badge>
          <Badge size="lg" tone="info">lg</Badge>
          <Badge tone="success" dot>com dot</Badge>
        </div>
      </Spec>

      {/* STATUS BADGE */}
      <Spec
        name="Status Badge"
        category="Componentes"
        description="Badge especializado que mapeia chaves de status do domínio (usuário, post, moderação) pra label PT-BR + tom."
        meta={[
          ['Componente', code('StatusBadge')],
          ['Onde é usado', 'colunas de status em Users, Blog, Moderação'],
          ['Variações', '12 chaves (active, published, review, open, resolved…)'],
        ]}
      >
        <StatusBadge status="active" />
        <StatusBadge status="published" />
        <StatusBadge status="review" />
        <StatusBadge status="banned" />
        <StatusBadge status="open" />
        <StatusBadge status="resolved" />
      </Spec>

      {/* AVATARES */}
      <Spec
        name="Avatares"
        category="Componentes"
        description="Foto/iniciais do usuário com indicador de presença e empilhamento em grupo."
        stageCol
        meta={[
          ['Componentes', <>{code('Avatar')} · {code('AvatarGroup')}</>],
          ['Onde é usado', 'tabelas de usuários, autores do blog, ranking'],
          ['Variações', '5 tamanhos (xs 20 → xl 56) · status online/offline/away · fallback iniciais'],
        ]}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => (
            <Avatar key={s} name="Ana Castela" size={s} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Cell label="Status">
            <div style={{ display: 'flex', gap: 8 }}>
              <Avatar name="On" status="online" />
              <Avatar name="Aw" status="away" />
              <Avatar name="Off" status="offline" />
            </div>
          </Cell>
          <Cell label="Grupo">
            <AvatarGroup
              users={[{ name: 'A B' }, { name: 'C D' }, { name: 'E F' }, { name: 'G H' }, { name: 'I J' }]}
              max={4}
            />
          </Cell>
        </div>
      </Spec>

      {/* ÍCONES */}
      <Spec
        name="Ícones"
        category="Componentes"
        description="Set inline derivado do Lucide, stroke currentColor, strokeWidth 1.75. Tamanho via prop (default 16)."
        stageCol
        meta={[
          ['Onde fica', code('@/components/icons')],
          ['Onde é usado', 'sidebar, botões, KPIs, estados — onipresente'],
          ['Observações', 'Tamanho é passado caso a caso (sem escala tokenizada) — ver Auditoria'],
        ]}
      >
        <div className={styles.iconGrid} style={{ width: '100%' }}>
          {ICON_NAMES.map((name) => {
            const Cmp = Icons[name] as React.ComponentType<{ size?: number }>;
            return (
              <div key={name} className={styles.iconCell}>
                <Cmp size={20} />
                <span>{name}</span>
              </div>
            );
          })}
        </div>
      </Spec>

      {/* SEARCH INPUT */}
      <Spec
        name="Search Input"
        category="Componentes"
        description="Input de busca com ícone de lupa embutido e variante pill."
        meta={[
          ['Componente', code('SearchInput')],
          ['Onde é usado', 'TopBar, toolbars de tabela, filtros'],
          ['Variações', 'default · pill'],
          ['Observações', 'É um 3º padrão de input (além de Input e Select) — convergir estilos (ver Auditoria)'],
        ]}
      >
        <SearchInput placeholder="Buscar…" />
        <SearchInput placeholder="Buscar (pill)…" pill />
      </Spec>
    </div>
  );
}

/* Pequeno wrapper pro Tooltip exigir um único ReactElement filho com ref. */
function IconInfoSafe() {
  return <Icons.IconInfo size={16} />;
}

/* ════════════════════════════════════════════════════════════
   NAVEGAÇÃO
   ════════════════════════════════════════════════════════════ */

const TAB_VARIANTS = ['bordered', 'pills', 'plain'] as const;

function NavegacaoSection() {
  const [demoTab, setDemoTab] = useState('um');
  const demoItems = [
    { id: 'um', label: 'Visão geral', count: 12 },
    { id: 'dois', label: 'Detalhes' },
    { id: 'tres', label: 'Histórico', count: 3 },
  ];

  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Como o usuário se move pelo painel. Sidebar e TopBar estão renderizadas
        ao vivo <strong>ao redor desta própria página</strong>.
      </p>

      {/* TABS */}
      <Spec
        name="Tabs"
        category="Navegação"
        description="Alternância entre vistas de uma mesma página. 3 variantes; conta opcional por aba."
        stageCol
        meta={[
          ['Componente', code('Tabs')],
          ['Onde é usado', 'Configurações, Desenvolvedor, esta página (header)'],
          ['Variações', 'bordered · pills · plain · count'],
        ]}
      >
        {TAB_VARIANTS.map((v) => (
          <div key={v} style={{ width: '100%' }}>
            <span className={styles.cellLabel}>{v}</span>
            <div style={{ marginTop: 8 }}>
              <Tabs items={demoItems} value={demoTab} onChange={setDemoTab} variant={v} />
            </div>
          </div>
        ))}
      </Spec>

      {/* SIDEBAR */}
      <Spec
        name="Sidebar"
        category="Navegação"
        description="Navegação primária à esquerda: grupos colapsáveis com ícone + leafs. Recolhível (248 → 76px) com tooltips."
        stageCol
        meta={[
          ['Componente', <>{code('components/layout/Sidebar.tsx')}</>],
          ['Onde é usado', 'shell de todo o admin'],
          ['Variações', 'expandida / recolhida · grupos: Visão, Plataforma, Conteúdo, Sistema…'],
          ['Estado ativo', 'leaf da rota atual destacado'],
        ]}
      >
        <div className={styles.adhocBanner} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-soft)' }}>
          <IconSettings size={18} /> Renderizada ao vivo à esquerda — este item Design System vive no grupo Sistema.
        </div>
      </Spec>

      {/* TOPBAR */}
      <Spec
        name="Topbar"
        category="Navegação"
        description="Barra superior (56px) com busca global, alternância de tema e sino de notificações."
        stageCol
        meta={[
          ['Componente', <>{code('components/layout/TopBar.tsx')}</>],
          ['Onde é usado', 'shell de todo o admin'],
          ['Altura', code('--topbar-h = 56px')],
        ]}
      >
        <div className={styles.adhocBanner} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-soft)' }}>
          <IconSearch size={18} /> Renderizada ao vivo no topo desta página.
        </div>
      </Spec>

      {/* BREADCRUMBS + MENUS + PAGINAÇÃO */}
      <Spec
        name="Breadcrumbs, Menus e Paginação"
        category="Navegação"
        description="Lacunas e padrões embutidos: não há Breadcrumbs nem Pagination como primitivos; a paginação vive dentro da Table."
        stageCol
        meta={[
          ['Breadcrumbs', 'NÃO existe — navegação é rasa (sidebar → página). Gap registrado'],
          ['Menus', <>dropdown de ações usa {code('IconMore')} + popover ad-hoc por página (sem primitivo Menu)</>],
          ['Paginação', <>embutida em {code('Table')} (prev/next + page size) — sem componente Pagination isolado</>],
        ]}
      >
        <Badge tone="warning">Breadcrumbs: ausente</Badge>
        <Badge tone="warning">Menu: ad-hoc</Badge>
        <Badge tone="info">Paginação: dentro da Table</Badge>
      </Spec>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FEEDBACK
   ════════════════════════════════════════════════════════════ */

function FeedbackSection() {
  const { push } = useToast();

  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Como a interface comunica estado: confirmações, erros, vazio e
        carregamento.
      </p>

      {/* TOASTS */}
      <Spec
        name="Toasts"
        category="Feedback"
        description="Notificação efêmera disparada por ação. 5 tipos. Provider montado no layout raiz; consumida via useToast()."
        meta={[
          ['Componentes', <>{code('ToastProvider')} · {code('useToast()')}</>],
          ['Onde é usado', 'após salvar/excluir em todo CRUD'],
          ['Tipos', 'default · success · error · info · warning'],
          ['Observações', 'Não há tipo loading — clique pra disparar cada um'],
        ]}
      >
        <Button variant="primary" onClick={() => push({ type: 'success', title: 'Salvo com sucesso' })}>
          success
        </Button>
        <Button variant="danger" onClick={() => push({ type: 'error', title: 'Algo deu errado', description: 'Tente novamente' })}>
          error
        </Button>
        <Button onClick={() => push({ type: 'info', title: 'Apenas um aviso' })}>info</Button>
        <Button onClick={() => push({ type: 'warning', title: 'Atenção necessária' })}>warning</Button>
        <Button variant="ghost" onClick={() => push({ type: 'default', title: 'Notificação neutra' })}>default</Button>
      </Spec>

      {/* ALERTS */}
      <Spec
        name="Alerts"
        category="Feedback"
        description="Mensagem inline persistente (erro de carga, aviso de seção). NÃO há primitivo Alert — cada página estiliza um banner ad-hoc."
        stageCol
        meta={[
          ['Status', 'padrão ad-hoc — NÃO é componente'],
          ['Onde é usado', 'banners de erro de carregamento em várias páginas'],
          ['Observações', 'Candidato a componente Alert (tons info/success/warning/danger) — ver Auditoria'],
        ]}
      >
        <div className={styles.adhocBanner}>
          <Icons.IconAlert size={18} /> Não foi possível carregar os dados. (reprodução do banner ad-hoc)
        </div>
      </Spec>

      {/* EMPTY STATE */}
      <Spec
        name="Empty States"
        category="Feedback"
        description="Estado vazio com ícone, título, descrição e ações. Usado quando uma lista/coleção não tem itens."
        stageCol
        meta={[
          ['Componente', code('EmptyState')],
          ['Onde é usado', 'tabelas e listagens sem resultados'],
          ['Props', <>{code('icon')} {code('title')} {code('description')} {code('actions')}</>],
        ]}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          <EmptyState
            icon={<IconStar size={28} />}
            title="Nada por aqui ainda"
            description="Quando houver itens, eles aparecem nesta lista."
            actions={<Button variant="primary" leadingIcon={<IconPlus size={15} />}>Criar item</Button>}
          />
        </div>
      </Spec>

      {/* LOADING / SKELETON */}
      <Spec
        name="Estados de carregamento"
        category="Feedback"
        description="Spinner centralizado (LoadingState) e o loading embutido no Button. Não há Skeleton no admin."
        stageCol
        meta={[
          ['Componente', code('LoadingState')],
          ['Onde é usado', 'carga inicial de páginas e tabelas'],
          ['Observações', 'Sem primitivo Skeleton (existe só no app público). Gap registrado na Auditoria'],
        ]}
      >
        <div style={{ width: '100%', maxWidth: 320 }}>
          <LoadingState label="Carregando dados…" />
        </div>
        <Button loading>Processando</Button>
      </Spec>

      {/* ESTADOS error/success/warning */}
      <Spec
        name="Estados de erro / sucesso / atenção"
        category="Feedback"
        description="Como os estados semânticos se manifestam nos componentes existentes."
        meta={[
          ['Erro', <>{code('Input errorText')}, Badge danger, toast error</>],
          ['Sucesso', 'StatusBadge active, Badge success, toast success'],
          ['Atenção', 'Badge warning, toast warning'],
        ]}
      >
        <Cell label="Erro">
          <Input defaultValue="inválido" errorText="Erro" inputSize="sm" />
        </Cell>
        <Cell label="Sucesso">
          <Badge tone="success" dot>OK</Badge>
        </Cell>
        <Cell label="Atenção">
          <Badge tone="warning" dot>Pendente</Badge>
        </Cell>
      </Spec>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DATA DISPLAY
   ════════════════════════════════════════════════════════════ */

interface DemoRow {
  id: string;
  nome: string;
  papel: string;
  status: 'active' | 'pending' | 'banned';
}

const TABLE_ROWS: DemoRow[] = [
  { id: '1', nome: 'Ana Castela', papel: 'Artista', status: 'active' },
  { id: '2', nome: 'João Pedro', papel: 'Moderador', status: 'pending' },
  { id: '3', nome: 'Marina Silva', papel: 'Fã', status: 'active' },
  { id: '4', nome: 'Conta Spam', papel: 'Fã', status: 'banned' },
];

const TABLE_COLUMNS: Column<DemoRow>[] = [
  {
    id: 'nome',
    header: 'Nome',
    cell: (r) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={r.nome} size="sm" />
        {r.nome}
      </span>
    ),
    sortKey: (r) => r.nome,
  },
  { id: 'papel', header: 'Papel', cell: (r) => r.papel, sortKey: (r) => r.papel },
  { id: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} />, align: 'right' },
];

function DataSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Como os dados são apresentados: contêineres, tabelas, indicadores e
        camadas sobrepostas.
      </p>

      {/* CARDS */}
      <Spec
        name="Cards"
        category="Data Display"
        description="Contêiner base de conteúdo. Composto por Header / Body / Footer; variantes interactive, elevated e flush."
        stageCol
        meta={[
          ['Componentes', <>{code('Card')} {code('CardHeader')} {code('CardBody')} {code('CardFooter')}</>],
          ['Onde é usado', 'estrutura de quase toda página (inclusive estes blocos)'],
          ['Variações', 'default · interactive (hover) · elevated · flush'],
          ['Observações', 'Padding interno difere entre Card / StatCard / Dialog — ver Auditoria'],
        ]}
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', width: '100%' }}>
          <div style={{ width: 280 }}>
            <Card>
              <CardHeader title="Card padrão" description="Header + Body + Footer" />
              <CardBody>Conteúdo do card.</CardBody>
              <CardFooter>
                <Button size="sm">Ação</Button>
              </CardFooter>
            </Card>
          </div>
          <div style={{ width: 280 }}>
            <Card interactive elevated>
              <CardHeader title="Interactive + elevated" />
              <CardBody>Hover pra ver o realce.</CardBody>
            </Card>
          </div>
        </div>
      </Spec>

      {/* KPIs */}
      <Spec
        name="KPIs"
        category="Data Display"
        description="Bloco indicador: rótulo + valor grande + tendência, sparkline e presença ao vivo."
        meta={[
          ['Componente', code('StatCard')],
          ['Onde é usado', 'Dashboard, Engajamento, Aquisição, Atividade'],
          ['Variações', 'trend +/− · secondary · spark (sparkline) · live (pulso)'],
        ]}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, width: '100%' }}>
          <StatCard label="Usuários" value="12.480" icon={<IconUsers size={16} />} trend={0.124} trendLabel="vs. mês passado" />
          <StatCard label="Churn" value="2,1%" icon={<IconActivity size={16} />} trend={-0.043} />
          <StatCard label="Engajamento" value="84%" secondary="meta 90%" spark={[3, 5, 4, 7, 6, 9, 8]} />
          <StatCard label="Online agora" value="327" live />
        </div>
      </Spec>

      {/* TABELAS */}
      <Spec
        name="Tabelas"
        category="Data Display"
        description="Tabela genérica com ordenação, seleção, paginação, toolbar, ações em massa e empty state."
        stageCol
        meta={[
          ['Componente', code('Table<T>')],
          ['Onde é usado', 'Users, Blog, Moderação, Convites, Materiais…'],
          ['Props', <>{code('columns')} {code('data')} {code('selectable')} {code('pageSize')} {code('loading')}</>],
        ]}
      >
        <div style={{ width: '100%' }}>
          <Table columns={TABLE_COLUMNS} data={TABLE_ROWS} rowId={(r) => r.id} pageSize={5} selectable />
        </div>
      </Spec>

      {/* MODAIS */}
      <Spec
        name="Modais"
        category="Data Display"
        description="Diálogo centralizado sobre overlay. Dialog genérico + ConfirmDialog para ações destrutivas. Entrada/saída family-style (spring) via Motion."
        meta={[
          ['Componentes', <>{code('Dialog')} · {code('ConfirmDialog')}</>],
          ['Onde é usado', 'criação/edição em CRUD, confirmação de exclusão'],
          ['Variações', 'size md/lg/xl · footer customizável · destructive'],
          ['Motion', <>backdrop fade + painel {code('scale + y')} (spring family-style) com saída animada (AnimatePresence)</>],
          ['Lazy', <>carregado via {code('next/dynamic')} só ao abrir (fora do bundle inicial)</>],
        ]}
      >
        <Button variant="primary" onClick={() => setDialogOpen(true)}>Abrir Dialog</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>Abrir ConfirmDialog</Button>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Título do diálogo"
          description="Subtítulo opcional com contexto da ação."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirmar</Button>
            </>
          }
        >
          <Input label="Campo de exemplo" placeholder="Digite algo" />
        </Dialog>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Excluir item?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          destructive
        />
      </Spec>

      {/* DRAWERS */}
      <Spec
        name="Drawers"
        category="Data Display"
        description="Painel deslizante a partir da direita. Mesma API do Dialog; ideal pra detalhe/edição extensa. Slide-in com spring (Motion)."
        meta={[
          ['Componente', code('Drawer')],
          ['Onde é usado', 'painéis de detalhe e edição lateral'],
          ['Variações', 'size md/lg/xl · footer · hideCloseButton'],
          ['Motion', <>painel {code('x: 100% → 0')} (spring) + backdrop fade, saída animada</>],
          ['Lazy', <>carregado via {code('next/dynamic')} só ao abrir</>],
        ]}
      >
        <Button onClick={() => setDrawerOpen(true)}>Abrir Drawer</Button>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Detalhe do registro"
          description="Painel lateral deslizante"
          footer={<Button variant="primary" onClick={() => setDrawerOpen(false)}>Salvar</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Nome" defaultValue="Ana Castela" />
            <Select label="Papel" options={SELECT_OPTIONS} defaultValue="a" />
            <Textarea label="Notas" rows={4} />
          </div>
        </Drawer>
      </Spec>

      {/* ACCORDIONS + LISTAGENS */}
      <Spec
        name="Accordions e Listagens"
        category="Data Display"
        description="Não há primitivo Accordion. Listagens usam um padrão de linha (row) repetido em FAQ, Onboarding e Fanpoints."
        stageCol
        meta={[
          ['Accordion', 'NÃO existe — conteúdo expansível é ad-hoc por página. Gap registrado'],
          ['Listagens', 'padrão de row reutilizado (avatar/título/subtítulo + ações) sem componente formal'],
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {['Como funciona o Fanpoints?', 'Posso trocar de plano?'].map((q) => (
            <div key={q} className={styles.listRow}>
              <Icons.IconInfo size={18} />
              <div className={styles.listRowMain}>
                <div className={styles.listRowTitle}>{q}</div>
                <div className={styles.listRowSub}>Reprodução do padrão de listagem ad-hoc</div>
              </div>
              <Button size="sm" variant="ghost" iconOnly aria-label="Editar">
                <Icons.IconEdit size={15} />
              </Button>
            </div>
          ))}
        </div>
      </Spec>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDITORIA DE CONSISTÊNCIA
   ════════════════════════════════════════════════════════════ */

interface Audit {
  title: string;
  desc: string;
  where: string;
  kind: 'inconsistencia' | 'gap';
  status?: 'resolvido' | 'parcial';
}

const AUDITS: Audit[] = [
  {
    title: 'Tokens de cor duplicados (mesmo valor, nomes diferentes)',
    desc: 'Resolvido: --neutral agora aponta pra --text-soft, --accent pra --text e --surface-hover pra --surface-3 (idênticos nos dois temas). Single source of truth. --border-soft e --focus-ring foram mantidos: divergem no tema claro.',
    where: 'app/globals.css',
    kind: 'inconsistencia',
    status: 'resolvido',
  },
  {
    title: 'Cor hardcoded na variante danger do Button',
    desc: 'Resolvido: criado o token --danger-fg (#FFFFFF nos dois temas); o botão danger e o spinner agora consomem o token em vez do hex fixo.',
    where: 'components/ui/Button.module.css',
    kind: 'inconsistencia',
    status: 'resolvido',
  },
  {
    title: 'Paddings de card divergentes',
    desc: 'Parcial: Card e StatCard convergem em --pad-surface (18px). Dialog mantém padding assimétrico por ter anatomia própria (header/body/footer).',
    where: 'Card / StatCard .module.css',
    kind: 'inconsistencia',
    status: 'parcial',
  },
  {
    title: 'Dois verdes (brand vs success)',
    desc: 'Resolvido: --success agora aponta pra --brand (um único verde no sistema). Identidade e estado positivo deixam de competir. Reversível trocando por literais.',
    where: 'app/globals.css',
    kind: 'inconsistencia',
    status: 'resolvido',
  },
  {
    title: 'Família pill sem tokens',
    desc: 'Resolvido: criados os tokens --pill-h/-pad/-font/-radius e o Badge passou a consumi-los. Geometria de rótulos compactos num só lugar.',
    where: 'app/globals.css + Badge.module.css',
    kind: 'inconsistencia',
    status: 'resolvido',
  },
  {
    title: 'Tamanhos de tipografia literais',
    desc: 'Parcial: escala --text-xs … --text-2xl criada e adotada em Input (label/helper/erro), Card, Dialog e PageHeader (eyebrow/descrição). Resta o resto do admin; título de página fica display 22px de propósito.',
    where: 'app/globals.css + *.module.css',
    kind: 'inconsistencia',
    status: 'parcial',
  },
  {
    title: 'Três padrões de campo "input"',
    desc: 'Resolvido: Select e SearchInput já importam o Input.module.css — a moldura de campo (altura, borda, foco) é uma só. Não há CSS duplicado.',
    where: 'Input / Select / SearchInput',
    kind: 'inconsistencia',
    status: 'resolvido',
  },
  {
    title: 'Tamanhos de ícone sem escala',
    desc: 'Parcial: criados os tokens --icon-sm/md/lg. Adoção nos call sites (que ainda passam size literal) é gradual.',
    where: 'app/globals.css + @/components/icons',
    kind: 'inconsistencia',
    status: 'parcial',
  },
  {
    title: 'Medidas px hardcoded em componentes',
    desc: 'Parcial: Badge migrou pra --pill-*; Card/StatCard pra --pad-surface. Avatar e a altura do input ainda fixam px — candidatos a tokenizar.',
    where: 'Avatar / Input .module.css',
    kind: 'inconsistencia',
    status: 'parcial',
  },
  {
    title: 'Sem primitivo Alert',
    desc: 'Mensagens inline de erro/aviso são banners ad-hoc por página, cada um com sua cor e espaçamento. Falta um componente Alert (info/success/warning/danger).',
    where: 'páginas com erro de carga',
    kind: 'gap',
  },
  {
    title: 'Sem primitivo Radio',
    desc: 'Não existe Radio/RadioGroup. Seleção única é resolvida com Select ou botões, o que enfraquece a semântica de formulário.',
    where: 'formulários',
    kind: 'gap',
  },
  {
    title: 'Sem componente de Upload',
    desc: 'Materiais e Blog montam dropzones/uploaders próprios. Um FileUpload reutilizável (preview, progresso, validação) reduziria duplicação.',
    where: 'Materiais / Blog',
    kind: 'gap',
  },
  {
    title: 'Sem Breadcrumbs nem Pagination isolados',
    desc: 'Não há trilha de navegação; a paginação só existe dentro da Table. Listagens não-tabulares ficam sem paginação padronizada.',
    where: 'navegação / listagens',
    kind: 'gap',
  },
  {
    title: 'Sem Accordion e sem Skeleton no admin',
    desc: 'Conteúdo expansível é ad-hoc; loading usa só spinner (LoadingState). O app público já tem Skeleton — vale portar pro admin.',
    where: 'Feedback / Data Display',
    kind: 'gap',
  },
];

function AuditoriaSection() {
  const incs = AUDITS.filter((a) => a.kind === 'inconsistencia');
  const gaps = AUDITS.filter((a) => a.kind === 'gap');

  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Pontos de divergência e lacunas mapeados ao construir esta documentação.
        Servem de backlog de padronização — não são correções aplicadas aqui.
      </p>

      <Card>
        <CardHeader
          title="Inconsistências"
          description="Mesma intenção, implementações divergentes"
          actions={<Badge tone="warning">{incs.length}</Badge>}
        />
        <CardBody>
          <div className={styles.audit}>
            {incs.map((a) => (
              <div
                key={a.title}
                className={`${styles.auditItem} ${a.status === 'resolvido' ? styles.auditItemDone : ''}`}
              >
                <div className={styles.auditBody}>
                  <span className={styles.auditTitle}>
                    {a.title}
                    {a.status === 'resolvido' && <Badge tone="success" size="sm">Resolvido</Badge>}
                    {a.status === 'parcial' && <Badge tone="warning" size="sm">Parcial</Badge>}
                  </span>
                  <span className={styles.auditDesc}>{a.desc}</span>
                  <span className={styles.auditWhere}>{a.where}</span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Lacunas (primitivos ausentes)"
          description="Componentes que faltam no Design System"
          actions={<Badge tone="info">{gaps.length}</Badge>}
        />
        <CardBody>
          <div className={styles.audit}>
            {gaps.map((a) => (
              <div key={a.title} className={`${styles.auditItem} ${styles.auditItemGap}`}>
                <div className={styles.auditBody}>
                  <span className={styles.auditTitle}>{a.title}</span>
                  <span className={styles.auditDesc}>{a.desc}</span>
                  <span className={styles.auditWhere}>{a.where}</span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PÁGINA
   ════════════════════════════════════════════════════════════ */

type TabId = 'foundations' | 'componentes' | 'navegacao' | 'feedback' | 'data' | 'auditoria';

const TABS: { id: TabId; label: string }[] = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'componentes', label: 'Componentes' },
  { id: 'navegacao', label: 'Navegação' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'data', label: 'Data Display' },
  { id: 'auditoria', label: 'Auditoria' },
];

export default function DesignSystemPage() {
  const [tab, setTab] = useState<TabId>('foundations');

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Design System"
        description="Documentação viva dos elementos visuais do admin — referência central pra análise, manutenção e padronização."
        tabs={<Tabs items={TABS} value={tab} onChange={setTab} variant="bordered" />}
      />
      <div className={styles.body}>
        {tab === 'foundations' && <FoundationsSection />}
        {tab === 'componentes' && <ComponentesSection />}
        {tab === 'navegacao' && <NavegacaoSection />}
        {tab === 'feedback' && <FeedbackSection />}
        {tab === 'data' && <DataSection />}
        {tab === 'auditoria' && <AuditoriaSection />}
      </div>
    </>
  );
}
