'use client';

/**
 * DS Plataforma — auditoria viva do design system do APP PRINCIPAL (src/).
 *
 * O app principal e o admin são apps Next SEPARADOS (builds/bundles
 * distintos), então esta página NÃO importa componentes da plataforma.
 * Ela é uma documentação de REFERÊNCIA: reproduz os tokens por valor,
 * cataloga os padrões/componentes reais (com caminhos de arquivo),
 * quantifica inconsistências e propõe um roadmap de escala.
 *
 * Base: auditoria de tokens + componentes + motion + inconsistências
 * varrendo `src/**` (≈162 componentes, ≈150 CSS modules).
 */

import { useState, type ReactNode } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import styles from './page.module.css';

/* ───────────────────────── helpers ───────────────────────── */

type MetaRow = [string, ReactNode];

function code(s: string) {
  return <code className={styles.code}>{s}</code>;
}

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
  description,
  badge,
  children,
}: {
  name: string;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={name} description={description} actions={badge} />
      <CardBody>
        <div className={styles.spec}>{children}</div>
      </CardBody>
    </Card>
  );
}

/* ───────────────────────── FOUNDATIONS ───────────────────────── */

const TEXT_TOKENS = [
  ['--ink', '#F5F5F7', 'Texto primário'],
  ['--ink-soft', '#A1A1AA', 'Secundário'],
  ['--ink-mute', '#71717A', 'Terciário'],
  ['--ink-faint', '#3F3F46', 'Quaternário'],
];
const ACCENT_TOKENS = [
  ['--accent', '#3DDB74', 'Verde — primário'],
  ['--accent-2', '#7DD3FC', 'Azul — secundário'],
  ['--accent-warm', '#FCB76B', 'Âmbar — terciário'],
];
const SURFACE_TOKENS: MetaRow[] = [
  ['--bg', <>{code('#000000')} — fundo sólido</>],
  ['--surface', <>{code('rgba(0,0,0,.80)')} — overlay base</>],
  ['--surface-2', <>{code('rgba(0,0,0,.88)')} — elevado</>],
  ['--surface-3', <>{code('rgba(10,10,10,.92)')} — opaco</>],
  ['--line', <>{code('rgba(255,255,255,.07)')} — divisor</>],
];

const GRADIENTS = [
  {
    name: 'CTA landing (magenta → indigo)',
    css: 'linear-gradient(90deg, #ff00b4, #5b00d1)',
    where: 'SectionCTA · Navbar · HeroSection',
  },
  {
    name: 'Botões do app (roxo → rosa)',
    css: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    where: 'MotionStateButton · AuthStateButton',
  },
  {
    name: 'CTA tri-cor — repetido ≈19×',
    css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a855f7 100%)',
    where: 'UserPicker · CommunityPanel · RankingStoreModal · …',
  },
  {
    name: 'Sucesso / celebração (verde)',
    css: 'linear-gradient(135deg, #5dffa1 0%, #3DDB74 100%)',
    where: 'AchievementCelebration · FeedCelebration',
  },
];

const RADII = [
  ['--r-sm', '12px'],
  ['--r-md', '18px'],
  ['--r-lg', '24px'],
  ['--r-xl', '32px'],
];

function FoundationsSection() {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        As bases visuais do app principal vivem em {code('src/app/globals.css')}.
        Existe um conjunto de tokens, mas ele é <strong>pouco consumido</strong>:
        a maioria dos {code('*.module.css')} fixa valores direto (ver Auditoria).
        Abaixo os tokens reais, reproduzidos por valor.
      </p>

      <Spec
        name="Cores — texto e accent"
        description="Tokens semânticos definidos no :root da plataforma."
        badge={<Badge tone="warning" size="sm">tokens subutilizados</Badge>}
      >
        <div style={{ width: '100%' }}>
          <span className={styles.cellLabel}>Texto (--ink-*)</span>
          <div className={styles.swatchGrid} style={{ marginTop: 8 }}>
            {TEXT_TOKENS.map(([tok, hex, hint]) => (
              <div key={tok} className={styles.swatch}>
                <div className={styles.swatchBox} style={{ background: hex }} />
                <span className={styles.swatchName}>{tok}</span>
                <span className={styles.swatchHint}>{hex} · {hint}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: '100%' }}>
          <span className={styles.cellLabel}>Accent</span>
          <div className={styles.swatchGrid} style={{ marginTop: 8 }}>
            {ACCENT_TOKENS.map(([tok, hex, hint]) => (
              <div key={tok} className={styles.swatch}>
                <div className={styles.swatchBox} style={{ background: hex }} />
                <span className={styles.swatchName}>{tok}</span>
                <span className={styles.swatchHint}>{hex} · {hint}</span>
              </div>
            ))}
          </div>
        </div>
        <Meta
          rows={[
            ['Superfícies', <span key="s">opacidades sobre preto (ver tabela abaixo)</span>],
            ['Observação', 'Não há tokens semânticos de estado (success/danger/warning); cores são hardcoded por componente'],
          ]}
        />
        <div style={{ width: '100%' }}>
          <span className={styles.cellLabel}>Superfícies & linha</span>
          <div style={{ marginTop: 8 }}>
            <Meta rows={SURFACE_TOKENS} />
          </div>
        </div>
      </Spec>

      <Spec
        name="Gradientes de marca"
        description="Os gradientes assinatura. Há vários roxo/rosa/magenta muito parecidos coexistindo — candidatos a 1–2 tokens."
        badge={<Badge tone="danger" size="sm">≈205 definições no total</Badge>}
      >
        <div className={styles.gradientGrid}>
          {GRADIENTS.map((g) => (
            <div key={g.name} className={styles.gradientRow}>
              <div className={styles.gradientBar} style={{ background: g.css }} />
              <div className={styles.gradientMeta}>
                <span className={styles.gradientName}>{g.name}</span>
                <span className={styles.gradientCode}>{g.where}</span>
              </div>
            </div>
          ))}
        </div>
      </Spec>

      <Spec
        name="Tipografia"
        description="Três famílias. Inter para interface, Instrument Serif para editorial, Borscha (self-hosted) para títulos de marca."
        badge={<Badge tone="warning" size="sm">sem escala de tamanho</Badge>}
      >
        <Meta
          rows={[
            ['Inter', <>{code('--sans')} · pesos 300–700 · interface (corpo 15px / 1.55)</>],
            ['Instrument Serif', <>{code('--serif')} · 400 + itálico · editorial/display</>],
            ['Borscha', <>self-hosted (300/400/700) · títulos landing/blog</>],
            ['Inconsistência', '≈39 tamanhos de fonte distintos hardcoded (12/13/14/11 + frações 12.5/13.5). Sem tokens --text-*'],
          ]}
        />
      </Spec>

      <Spec
        name="Border radius"
        description="Tokens de raio existem, mas componentes usam 50% + 999px pro mesmo pill e raios soltos (6/8/10/14/16/20)."
        badge={<Badge tone="warning" size="sm">tokens ignorados</Badge>}
      >
        <div className={styles.stage}>
          {RADII.map(([tok, px]) => (
            <div key={tok} className={styles.radiusBox} style={{ borderRadius: px }}>
              {tok.replace('--r-', '')} · {px}
            </div>
          ))}
        </div>
        <Meta
          rows={[
            ['Observação', <>{code('50%')} (≈314×) e {code('999px')} (≈184×) usados pro mesmo pill — redundância</>],
            ['Faltando', 'tokens de espaçamento, de sombra e de z-index (nenhum existe na plataforma)'],
          ]}
        />
      </Spec>
    </div>
  );
}

/* ───────────────────────── COMPONENTES ───────────────────────── */

type Verdict = 'canônico' | 'parcial' | 'fragmentado' | 'ausente';
const VERDICT_TONE: Record<Verdict, BadgeTone> = {
  canônico: 'success',
  parcial: 'warning',
  fragmentado: 'danger',
  ausente: 'neutral',
};

interface CompRow {
  type: string;
  verdict: Verdict;
  desc: string;
  where: string;
}

const COMPONENTS: CompRow[] = [
  {
    type: 'Botões / CTAs',
    verdict: 'fragmentado',
    desc: 'Sem Button(variant, size) canônico. Vários multi-state e CTAs bespoke + <button> inline espalhado, com padding/hover/foco divergentes.',
    where: 'MotionStateButton · AuthStateButton · HeartButton · RankingButton · LocateButton',
  },
  {
    type: 'Inputs / Formulários',
    verdict: 'ausente',
    desc: 'Quase nada reutilizável. Campos de auth/perfil são <input> cru, sem wrapper de label/erro/helper/validação.',
    where: 'CommentInput · MotionCheckbox · MotionSwitch (só esses)',
  },
  {
    type: 'Modais / Sheets / Drawers',
    verdict: 'parcial',
    desc: '2 shells sólidos (desktop centralizado + sheet mobile com swipe-to-close, spring 380/32). ~11 modais de domínio. PlaylistModal é bespoke (não usa shell). Sem ModalHeader/Body/Footer.',
    where: 'MotionModalShell · MobileSheetShell · PlaylistModal (legado)',
  },
  {
    type: 'Cards / Tiles',
    verdict: 'fragmentado',
    desc: 'Sem Card canônico. Cada feature define seu próprio layout (padding/borda/sombra/hover divergentes).',
    where: 'ActivityCard · PostCard · ProfileCardStack + cards inline',
  },
  {
    type: 'Badges / Pills / Chips',
    verdict: 'fragmentado',
    desc: 'Sem Badge(tone, size) genérico. Pills purpose-built + .pill copiado em 8+ módulos com raios diferentes.',
    where: 'VerifiedBadge · LiveBadge · StatsPill · RankMedallion',
  },
  {
    type: 'Avatares',
    verdict: 'ausente',
    desc: '<img> inline com placeholder; alt varia; VerifiedBadge posicionado pelo caller. Sem componente Avatar (tamanho/fallback/status).',
    where: 'inline em ArtistBox / UserPicker / CommunityPanel / …',
  },
  {
    type: 'Tabs / Segmented',
    verdict: 'fragmentado',
    desc: 'Modelos diferentes: FilterTabs (CSS estático) vs ArtistBox (pill animado via layoutId) vs tabs inline em ProfilePanel/Fanpoints/Comunidades.',
    where: 'FilterTabs · ArtistBox · ProfilePanel · FanpointsModal',
  },
  {
    type: 'Toasts / Notificações',
    verdict: 'fragmentado',
    desc: '4 implementações separadas, cada uma com ciclo de vida e CSS próprios. Sem ToastProvider/useToast — novo tipo = duplicar tudo.',
    where: 'AppToast · PointsToast · SocialAchievementToast · SameTrackToast',
  },
  {
    type: 'Skeleton / Loading',
    verdict: 'canônico',
    desc: 'Skeleton único e bem parametrizado (rect/circle/text, stagger, respeita reduced-motion). Spinners ad-hoc convivem; empty/error states são só texto.',
    where: 'Skeleton.tsx',
  },
];

function ComponentesSection() {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Achado central: <strong>não existe uma camada de primitivos</strong>{' '}
        ({code('src/components/ui/')} não existe). O app é feature-first —
        cada área reimplementa botão/card/badge/tab localmente. Veredito por
        família abaixo.
      </p>

      <Card>
        <CardHeader
          title="Inventário de primitivos"
          description="Verdito de consolidação por tipo (canônico → ausente)"
          actions={<Badge tone="danger" size="sm">0 camada ui/</Badge>}
        />
        <CardBody>
          <div className={styles.verdict}>
            {COMPONENTS.map((c) => (
              <div key={c.type} className={styles.verdictItem}>
                <div className={styles.verdictHead}>
                  <span className={styles.verdictName}>{c.type}</span>
                  <Badge tone={VERDICT_TONE[c.verdict]} size="sm">
                    {c.verdict}
                  </Badge>
                </div>
                <span className={styles.verdictDesc}>{c.desc}</span>
                <span className={styles.verdictWhere}>{c.where}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ───────────────────────── MOTION ───────────────────────── */

const MOTION_HELPERS: MetaRow[] = [
  ['MotionStateButton', 'botão multi-state (idle → pending → success/error), spring 380/32'],
  ['HeartButton', 'like com pop + burst de 6 sparkles'],
  ['NumberTicker', 'interpolação de número (useMotionValue + useTransform), aria-live'],
  ['MotionSwitch', 'toggle com thumb animado (spring 700/36)'],
  ['SwipeAction', 'swipe-to-reveal estilo iOS (drag + snap)'],
  ['MotionConfetti / HeartsCascade', 'partículas de celebração'],
  ['Skeleton', 'shimmer (CSS) com stagger e reduced-motion'],
];

function MotionSection() {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        A plataforma já usa {code('motion/react')} de forma madura em vários
        componentes, com um spring padrão coerente ({code('stiffness 380 / damping 32')}).
        Os problemas são de <strong>consistência</strong>, não de ausência.
      </p>

      <Spec
        name="Helpers de motion reutilizáveis"
        description="Boa base — esses são realmente reaproveitáveis."
        badge={<Badge tone="success" size="sm">base sólida</Badge>}
      >
        <Meta rows={MOTION_HELPERS} />
      </Spec>

      <Spec
        name="Inconsistências de motion"
        description="Onde o padrão quebra."
        badge={<Badge tone="warning" size="sm">3 pontos</Badge>}
      >
        <Meta
          rows={[
            ['Gradiente de CTA', 'landing usa magenta→indigo (CSS); app usa roxo→rosa (motion) — duas CTAs assinatura visualmente distintas'],
            ['Tab pill', <>{code('layoutId')} (ArtistBox) vs CSS estático (FilterTabs) — dois modelos pro mesmo padrão</>],
            ['Reduced-motion', '≈70% coberto; faltam checks explícitos em MotionStateButton, MotionSwitch e NumberTicker'],
            ['Modais', 'PlaylistModal não usa os shells (state machine + keyframes próprios)'],
          ]}
        />
      </Spec>
    </div>
  );
}

/* ───────────────────────── AUDITORIA ───────────────────────── */

interface Audit {
  title: string;
  count: string;
  desc: string;
  where: string;
  arch?: boolean;
}

const AUDITS: Audit[] = [
  {
    title: 'Cores hardcoded (tokens ignorados)',
    count: '40+ hex',
    desc: 'Mesma cor escrita de várias formas: branco como #fff (≈209×), #ffffff (≈175×) e #FFFFFF (≈21×); accent como #3ddb74 e #3DDB74. Os tokens --ink/--accent existem mas quase não são usados.',
    where: 'layout.module.css · verify.module.css · CommunityPanel.module.css',
  },
  {
    title: 'Sem escala tipográfica',
    count: '≈39 tamanhos',
    desc: 'Cada módulo fixa font-size em px (12/13/14/11 + frações 12.5/13.5 + outliers 48/56/72). Zero tokens --text-*.',
    where: '*.module.css (≈150 arquivos)',
  },
  {
    title: 'Border-radius redundante',
    count: '12 valores',
    desc: '50% (≈314×) e 999px (≈184×) usados pro mesmo pill; raios soltos 6/8/10/14/16/20. Tokens --r-* praticamente não consumidos.',
    where: 'page.module.css · UserPicker · FeedPanel',
  },
  {
    title: 'Gradientes duplicados',
    count: '≈205 / top 19×',
    desc: 'O gradiente tri-cor #f97316→#ec4899→#a855f7 aparece verbatim em ≈19 arquivos. Nenhum gradiente é tokenizado.',
    where: 'UserPicker · CommunityPanel · RankingStoreModal · ShowDayLayer',
  },
  {
    title: 'Sem escala de espaçamento',
    count: '≈32 valores',
    desc: 'Paddings/margins/gaps 100% hardcoded; padding: 10px 12px repetido ≈24×. Sem grid de 8px nem tokens --space-*.',
    where: 'QuizPost · UserPicker · CommunityPanel',
  },
  {
    title: 'z-index sem escala',
    count: '44 valores',
    desc: 'Magic numbers (9999, 9500, 9000, 8500, 1500, 1000, 800) sem hierarquia documentada — risco alto de colisão de stacking.',
    where: 'Lightbox · FanverseSearch · MaterialsTabContent',
  },
  {
    title: 'Breakpoints fragmentados',
    count: '9 distintos',
    desc: 'Media queries em 480/560/600/640/720/768/880/900/1024/1100 sem mapa — responsivo imprevisível entre componentes.',
    where: 'HeroSection · layout.module.css · CommunityPanel',
  },
  {
    title: '!important espalhado',
    count: '≈178',
    desc: 'Parte justificada (acessibilidade), parte como força bruta de cascata — sintoma de especificidade descontrolada.',
    where: 'globals.css · layout.module.css · modais',
  },
  {
    title: 'Arquitetura: sem camada de primitivos',
    count: '0 ui/',
    desc: 'Não há src/components/ui/. Pior: componentes sequestram variáveis globais (FeedPanel redefine --accent para #ff2e9a), quebrando o significado dos tokens.',
    where: 'src/components/** (feature-first)',
    arch: true,
  },
];

function AuditoriaSection() {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        O diagnóstico em uma frase: <strong>os sistemas existem mas são
        ignorados na prática</strong>. Cada componente reinventa o estilo
        localmente. Evidência quantificada (varredura de {code('src/**/*.css')}):
      </p>

      <Card>
        <CardHeader
          title="Inconsistências em escala"
          description="Contagens aproximadas + exemplos representativos"
          actions={<Badge tone="warning">{AUDITS.length}</Badge>}
        />
        <CardBody>
          <div className={styles.audit}>
            {AUDITS.map((a) => (
              <div
                key={a.title}
                className={`${styles.auditItem} ${a.arch ? styles.auditItemArch : ''}`}
              >
                <div className={styles.auditBody}>
                  <span className={styles.auditTitle}>
                    {a.title}
                    <Badge tone={a.arch ? 'danger' : 'neutral'} size="sm">{a.count}</Badge>
                  </span>
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

/* ───────────────────────── ROADMAP ───────────────────────── */

interface Phase {
  num: string;
  title: string;
  items: ReactNode[];
}

const ROADMAP: Phase[] = [
  {
    num: 'P0',
    title: 'Tokens — a base da escala (sem mudança visual)',
    items: [
      <>Escala tipográfica {code('--text-xs…--text-2xl')} e de espaçamento {code('--space-*')} (grid de 8px).</>,
      <>Tokenizar os gradientes assinatura ({code('--grad-cta')}, {code('--grad-success')}) — colapsar os roxo/rosa duplicados.</>,
      <>Escala de {code('--z-*')} (base/dropdown/modal/overlay/toast) e mapa de breakpoints.</>,
      <>Normalizar cor: um formato (lowercase, sem variações) e migrar componentes pra {code('--ink/--accent/--surface')}.</>,
    ],
  },
  {
    num: 'P1',
    title: 'Camada de primitivos — src/components/ui/',
    items: [
      <>Extrair {code('Button')} (variant/size/state), {code('Card')}, {code('Badge')}, {code('Avatar')}, {code('Tabs')} (um modelo só).</>,
      <>Unificar os 4 toasts num {code('ToastProvider')} + {code('useToast()')} (espelhar o que o admin já tem).</>,
      <>{code('ModalHeader/Body/Footer')} sobre os shells existentes; portar PlaylistModal pro shell.</>,
      <>{code('Field')} de formulário (label/erro/helper/validação) pra auth e perfil.</>,
    ],
  },
  {
    num: 'P2',
    title: 'Governança & guardrails — manter a escala',
    items: [
      <>Stylelint proibindo hex/px cru fora dos tokens (falha no CI, como o journal.test).</>,
      <>{code('useReducedMotion')} explícito nos componentes de motion que faltam.</>,
      <>Doc viva / Storybook + matriz de maturidade (alpha/beta/stable) por componente.</>,
      <>Proibir sequestro de variável global (componente não redefine {code('--accent')}).</>,
    ],
  },
];

function RoadmapSection() {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Caminho pra profissionalizar e escalar — do mais seguro (tokens, sem
        mudança visual) ao estrutural (primitivos) e à governança que impede a
        regressão.
      </p>
      <div className={styles.roadmap}>
        {ROADMAP.map((p) => (
          <div key={p.num} className={styles.phase}>
            <span className={styles.phaseNum}>{p.num}</span>
            <div className={styles.phaseBody}>
              <span className={styles.phaseTitle}>{p.title}</span>
              <ul className={styles.phaseList}>
                {p.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── PÁGINA ───────────────────────── */

type TabId = 'foundations' | 'componentes' | 'motion' | 'auditoria' | 'roadmap';

const TABS: { id: TabId; label: string }[] = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'componentes', label: 'Componentes' },
  { id: 'motion', label: 'Motion' },
  { id: 'auditoria', label: 'Auditoria' },
  { id: 'roadmap', label: 'Roadmap' },
];

export default function DesignSystemPlataformaPage() {
  const [tab, setTab] = useState<TabId>('foundations');

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="DS Plataforma"
        description="Auditoria do design system do app principal (src/) — tokens, componentes, motion, inconsistências e roadmap de escala."
        tabs={<Tabs items={TABS} value={tab} onChange={setTab} variant="bordered" />}
      />
      <div className={styles.body}>
        <div className={styles.notice}>
          <span>
            <strong>Referência, não gallery ao vivo.</strong> O app principal e o
            admin são apps Next separados, então esta página documenta a
            plataforma por valor (tokens reproduzidos + caminhos reais de
            arquivo), em vez de importar os componentes de {code('src/')}.
          </span>
        </div>

        {tab === 'foundations' && <FoundationsSection />}
        {tab === 'componentes' && <ComponentesSection />}
        {tab === 'motion' && <MotionSection />}
        {tab === 'auditoria' && <AuditoriaSection />}
        {tab === 'roadmap' && <RoadmapSection />}
      </div>
    </>
  );
}
