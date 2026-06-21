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

type Sev = 'alta' | 'média' | 'baixa';
type Eff = 'baixo' | 'médio' | 'alto';

interface Vis {
  cat: string;
  title: string;
  desc: string;
  where: string;
  sev?: Sev;
  eff?: Eff;
  rec?: string;
  done?: boolean; // resolvido no P0
  via?: string;
}

/* Já resolvido no P0 (byte-idêntico, no ar). */
const RESOLVED: Vis[] = [
  {
    cat: 'Cores',
    title: 'Mesma cor em 3 formatos (branco/preto)',
    desc: 'Branco aparecia como #fff / #ffffff / #FFFFFF e preto como #000/#000000; accent como #3ddb74 e #3DDB74.',
    where: '64 arquivos',
    done: true,
    via: 'normalizado #ffffff→#fff, #000000→#000 (213×)',
  },
  {
    cat: 'Cores',
    title: 'Cores de texto hardcoded',
    desc: 'Os tons de texto (#F5F5F7/#A1A1AA/#71717A/#3F3F46) repetidos como literais em vez dos tokens.',
    where: '53 arquivos',
    done: true,
    via: 'tokenizado var(--ink-*) (241×)',
  },
  {
    cat: 'Gradientes',
    title: 'Gradiente assinatura duplicado ≈19×',
    desc: 'O tri-cor laranja→rosa→roxo (e os outros 3 de marca) copiados verbatim em vários arquivos.',
    where: '17 arquivos',
    done: true,
    via: 'tokenizado var(--grad-*) (25×)',
  },
  {
    cat: 'Camadas',
    title: 'z-index magic numbers (camadas principais)',
    desc: 'Valores 100/200/300/1000/1500/9999 espalhados como literais sem hierarquia.',
    where: '21 arquivos',
    done: true,
    via: 'tokens --z-* (25×); bandas especiais ainda pendentes (ver abaixo)',
  },
];

/* Pendente — para avaliar e decidir. Ordenado por severidade. */
const PENDING: Vis[] = [
  {
    cat: 'Componentes',
    title: 'Sem botão canônico',
    desc: '✓ DECIDIDO + primitivo CRIADO (src/components/ui/Button.tsx, branch ds/button-canonico): pill magenta→indigo em 2 tamanhos (md 14px · sm 10px) + variantes primary/danger/ghost, absorvendo os estados idle/loading/success/erro. A galeria abaixo simula tudo: estados, escala menor, e o inventário do que MESCLA no canônico vs o que MANTÉM como variação própria.',
    where: 'mesclam: MotionStateButton · AuthStateButton · Navbar ctaPill · primaryCta/joinPill · Quiz solveBtn · ConfirmDialog. mantêm: HeartButton · ícones (add/close/back) · FAB · tabs',
    sev: 'alta',
    eff: 'alto',
    rec: 'Migrar os 9 call sites pro Button canônico (auth = QA no /app) e remover MotionStateButton/AuthStateButton/ctaPill/--grad-cta-app. Pontos a fechar na galeria: ConfirmDialog verde (vira primary ou ganha variante "confirm"?), primaryCta/joinPill roxo translúcido (vira ghost/tonal?), TopBar branco (variante light?).',
  },
  {
    cat: 'Cores',
    title: 'Duas CTAs assinatura diferentes',
    desc: '✓ DECIDIDO: o padrão é o magenta→indigo — linear-gradient(90deg, #ff00b4, #5b00d1) (token --grad-cta). O roxo→rosa (--grad-cta-app) será removido.',
    where: 'manter --grad-cta · remover --grad-cta-app',
    sev: 'média',
    eff: 'baixo',
    rec: 'Trocar os usos de --grad-cta-app por --grad-cta e remover o token. Vai junto com a unificação do botão canônico.',
  },
  {
    cat: 'Cores',
    title: 'FeedPanel sequestra o verde da marca',
    desc: '✓ DECIDIDO (seguir recomendação): o FeedPanel deixa de redefinir --accent global; passa a usar tokens próprios --feed-accent (#ff2e9a) e --feed-accent2 (#a855f7).',
    where: 'FeedPanel.module.css',
    sev: 'média',
    eff: 'baixo',
    rec: 'Trocar as redefinições de --accent/--accent2 no FeedPanel por --feed-accent/--feed-accent2 locais.',
  },
  {
    cat: 'Componentes',
    title: 'Cards ad-hoc por feature',
    desc: '✓ DECIDIDO: ActivityCard adota o estilo do SameTrackToast (pill r999, gradiente escuro + blur). QuizPost/MediaPost passam a r6 (eram r16). PostCard mantém r8.',
    where: 'ActivityCard → SameTrackToast · QuizPost/MediaPost r16→6 · PostCard r8',
    sev: 'média',
    eff: 'médio',
    rec: 'Aplicar na plataforma: ActivityCard → casca do SameTrackToast; QuizPost/MediaPost border-radius 16→6.',
  },
  {
    cat: 'Componentes',
    title: 'Badges / pills sem padrão',
    desc: '✓ DECIDIDO: VerifiedBadge mantido. Pill padrão = branco r999 (estilo do UserPicker addBtn); o joinPill roxo do CommunityPanel passa a seguir esse padrão. LiveBadge e StatsPill saem.',
    where: 'manter VerifiedBadge + pill branco · remover LiveBadge + StatsPill',
    sev: 'média',
    eff: 'médio',
    rec: 'Migrar joinPill pro pill branco; remover LiveBadge e StatsPill; manter VerifiedBadge.',
  },
  {
    cat: 'Componentes',
    title: 'Tabs em dois modelos',
    desc: '✓ DECIDIDO: manter os dois estilos (FilterTabs estático e ArtistBox pill animado) — usos diferentes, convivência intencional.',
    where: 'FilterTabs + ArtistBox/ProfilePanel/FanpointsModal',
    sev: 'baixa',
    eff: 'baixo',
    rec: 'Sem mudança de código — só documentar quando usar cada um.',
  },
  {
    cat: 'Componentes',
    title: 'Sem componente de Avatar',
    desc: '✓ DECIDIDO: componente Avatar único com o padrão do 40px (anel 1px rgba(255,255,255,.12) + dot de presença), em 6 tamanhos: 32, 36, 40, 42, 56, 64px.',
    where: 'criar Avatar(size, status) · migrar usos inline',
    sev: 'média',
    eff: 'médio',
    rec: 'Avatar(size, status, fallback) com os 6 tamanhos + VerifiedBadge composável; migrar os <img> inline.',
  },
  {
    cat: 'Componentes',
    title: '4 toasts independentes',
    desc: '✓ DECIDIDO: a estrutura do SameTrackToast (pill r999, gradiente 160° escuro + blur + borda) vira o padrão dos 4 toasts. AppToast, PointsToast e SocialAchievement adotam a mesma casca; o conteúdo (ícone/avatar/barras) varia por tipo.',
    where: 'casca = SameTrackToast · AppToast/PointsToast/SocialAchievement adotam',
    sev: 'média',
    eff: 'médio',
    rec: 'Unificar num ToastProvider/useToast com a casca do SameTrackToast (espelhar o admin).',
  },
  {
    cat: 'Componentes',
    title: 'Modais: 1 fora do padrão + 3 tiers de z',
    desc: 'Há 2 shells bons (Motion/MobileSheet), mas o PlaylistModal anima por conta própria (state machine + keyframes). E modais aparecem em 130, 300 e 1000 de z-index.',
    where: 'PlaylistModal vs MotionModalShell · z 130/300/1000',
    sev: 'média',
    eff: 'médio',
    rec: 'Portar PlaylistModal pro shell; unificar o tier de z dos modais.',
  },
  {
    cat: 'Camadas',
    title: 'z-index: bandas especiais e micro-ordem',
    desc: 'A banda 240–260 (TopBar/BottomNav) tem ordem proposital de 1px e os overlays especiais (800/8500/9000/9500) são magic numbers. Não dá pra colapsar sem redesenhar o layering.',
    where: 'TopBar · BottomNav · FanverseSearch · FindMyLove · HeartsCascade',
    sev: 'média',
    eff: 'alto',
    rec: 'Redesign de layering (camadas canônicas + mover overlays) com QA no /app — não é sweep mecânico.',
  },
  {
    cat: 'Tipografia',
    title: 'Sem escala tipográfica adotada',
    desc: '✓ DECIDIDO: escala = 12 (mínimo) · 14 · 16 · 18 · 22 · 28. Os fracionários 12.5/13/13.5 snapam pra 12; o 15 sai. Nada abaixo de 12.',
    where: '*.module.css (≈150 arquivos)',
    sev: 'média',
    eff: 'alto',
    rec: 'Redefinir --text-* nessa escala (12/14/16/18/22/28) e migrar os componentes (muda pixels — snap pro valor mais próximo, QA no /app).',
  },
  {
    cat: 'Cores',
    title: 'Paleta roxo/rosa não tokenizada',
    desc: '✓ DECIDIDO: 2 canônicos. Todo roxo vira #9333ea (saem #a855f7 e #c084fc); todo rosa/fúcsia vira #ec4899 (saem #d946ef e #f472b6).',
    where: 'gradientes e fills de vários módulos',
    sev: 'baixa',
    eff: 'médio',
    rec: 'Tokenizar como --purple (#9333ea) e --pink (#ec4899) e migrar os fills/gradientes (muda pixels nos tons removidos — QA no /app).',
  },
  {
    cat: 'Forma',
    title: 'Raios de pill/card variados',
    desc: '✓ DECIDIDO: pill/círculo = 999px (sai o 50%); card = 8px (saem 12/16/18). QuizPost/Media seguem em 6px (decidido antes). Nada de raios intermediários.',
    where: 'UserPicker · FeedPanel · cards diversos',
    sev: 'baixa',
    eff: 'médio',
    rec: 'Snap pra --r-card (8px) e --r-pill (999px); migrar os 12/16/18/50% (muda cantos — QA no /app).',
  },
  {
    cat: 'Espaçamento',
    title: 'Densidade inconsistente',
    desc: '✓ DECIDIDO: adotar a escala --space-* (grid de 4px). Os paddings ad-hoc (10×12, 12×14, 8×14) snapam pro múltiplo de 4 mais próximo.',
    where: 'QuizPost · UserPicker · CommunityPanel',
    sev: 'baixa',
    eff: 'alto',
    rec: 'Migrar pra --space-* gradualmente, por superfície (muda pixels — QA no /app).',
  },
  {
    cat: 'Estados',
    title: 'Empty / error states só texto',
    desc: '✓ DECIDIDO: criar um componente de estado reutilizável (ícone + texto + ação). Substitui os textos puros de vazio/erro espalhados.',
    where: 'modais, listas, painéis',
    sev: 'baixa',
    eff: 'médio',
    rec: 'EmptyState reutilizável (ícone + título + ação opcional) e trocar os call sites — Skeleton continua pros loadings.',
  },
  {
    cat: 'Responsivo',
    title: 'Breakpoints fragmentados',
    desc: '✓ DECIDIDO: manter TODOS os breakpoints (foram colocados de forma minuciosa, caso a caso) — só documentar/nomear um mapa de referência, sem remover nenhum.',
    where: 'HeroSection · layout · CommunityPanel',
    sev: 'baixa',
    eff: 'alto',
    rec: 'Documentar o mapa (480/560/600/640/720/768/880/900/1024/1100) como referência — sem migração que mude comportamento.',
  },
  {
    cat: 'Motion',
    title: 'Reduced-motion incompleto',
    desc: '✓ DECIDIDO + IMPLEMENTADO: useReducedMotion adicionado nos componentes que faltavam (MotionSwitch, NumberTicker). Zero mudança visual no padrão — só quem liga "reduzir movimento" no SO pula a animação.',
    where: 'componentes de motion',
    sev: 'baixa',
    eff: 'baixo',
    rec: 'Feito: hook respeitado em todos os componentes de motion. (MotionStateButton sai na padronização de botões.)',
  },
];

const SEV_TONE: Record<Sev, BadgeTone> = { alta: 'danger', média: 'warning', baixa: 'neutral' };

const SEV_BORDER: Record<Sev, string> = {
  alta: 'var(--danger)',
  média: 'var(--warning)',
  baixa: 'var(--border-strong)',
};

function CatTag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--text-mute)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-full)',
        padding: '1px 8px',
      }}
    >
      {children}
    </span>
  );
}

/* ── Reproduções literais (estilos copiados verbatim de src/) ── */

function RC({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div className={styles.reproCell}>
      {children}
      <span className={styles.reproTag}>{tag}</span>
    </div>
  );
}
function Verified() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1d9bf0" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Star() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="#f59e0b" aria-hidden="true">
      <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.6l6.9-.7z" />
    </svg>
  );
}
function Check() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#3ddb74" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
function Heart({ fill, color }: { fill: string; color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.6-9.3-8.4C1.2 9 2.3 5.8 5.4 5.2 7.6 4.8 9.6 6 12 8.6 14.4 6 16.4 4.8 18.6 5.2c3.1.6 4.2 3.8 2.7 6.4C19 15.4 12 20 12 20z" />
    </svg>
  );
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.45em',
  border: 'none',
  borderRadius: 999,
  color: '#fff',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};
const avatarCircle = (size: number, ring: string, extra?: React.CSSProperties): React.CSSProperties => ({
  width: size,
  height: size,
  borderRadius: '50%',
  background: 'linear-gradient(135deg,#3a3a44,#1c1c22)',
  border: ring,
  position: 'relative',
  ...extra,
});

const toastShell: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 999,
  background: 'linear-gradient(160deg, rgba(6,6,14,0.96), rgba(4,4,10,0.96))',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 12px 32px -8px rgba(0,0,0,0.7)',
  fontSize: 12.5,
  color: 'rgba(245,245,247,0.7)',
  whiteSpace: 'nowrap',
};

/* ── Galeria de botões (Button canônico) ───────────────────
 * Simula o Button canônico (variantes × tamanhos × estados) + o
 * inventário dos botões da plataforma hoje, marcando o que MESCLA
 * nele e o que se MANTÉM como variação. Reproduz por valor (admin
 * não importa componentes da plataforma). Estado real do canônico:
 * src/components/app... → src/components/ui/Button.tsx (branch). */
const GRAD_CTA = 'linear-gradient(90deg, #ff00b4 0%, #5b00d1 50%, #ff00b4 100%)';
const SZ_MD: React.CSSProperties = { fontSize: 14, padding: '11px 22px' };
const SZ_SM: React.CSSProperties = { fontSize: 10, padding: '6px 14px' };
const ST_SUCCESS: React.CSSProperties = { background: '#2bb673' };
const ST_ERROR: React.CSSProperties = { background: '#e5484d' };
const ST_DISABLED: React.CSSProperties = { background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.42)' };

function SpinIco({ c = '#fff' }: { c?: string }) {
  return <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M14 8a6 6 0 1 1-3-5.196" /></svg>;
}
function ChkIco({ c = '#fff' }: { c?: string }) {
  return <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8l3.5 3.5L13 5" /></svg>;
}
function CrsIco({ c = '#fff' }: { c?: string }) {
  return <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}
function GHead({ children }: { children: ReactNode }) {
  return <div style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9a9aa6', marginTop: 8 }}>{children}</div>;
}
function GRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>{children}</div>;
}
function GBtn({ s, label, ico, tag, dim, strike }: { s: React.CSSProperties; label: string; ico?: ReactNode; tag: string; dim?: boolean; strike?: boolean }) {
  return (
    <RC tag={tag}>
      <span style={{ ...btnBase, ...s, opacity: dim ? 0.4 : 1, textDecoration: strike ? 'line-through' : undefined }}>{ico}{label}</span>
    </RC>
  );
}

function ButtonGallery() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <GHead>① Button canônico — primary · estados (md · 14px)</GHead>
      <GRow>
        <GBtn s={{ ...SZ_MD, background: GRAD_CTA }} label="Meu Fanverse" tag="idle" />
        <GBtn s={{ ...SZ_MD, background: GRAD_CTA }} ico={<SpinIco />} label="Enviando…" tag="loading" />
        <GBtn s={{ ...SZ_MD, ...ST_SUCCESS }} ico={<ChkIco />} label="Pronto" tag="success" />
        <GBtn s={{ ...SZ_MD, ...ST_ERROR }} ico={<CrsIco />} label="Erro" tag="erro" />
        <GBtn s={{ ...SZ_MD, ...ST_DISABLED }} label="Inativo" tag="disabled" />
      </GRow>

      <GHead>② primary · escala menor (sm · 10px) — mesma família de estados</GHead>
      <GRow>
        <GBtn s={{ ...SZ_SM, background: GRAD_CTA }} label="Entrar" tag="idle · sm" />
        <GBtn s={{ ...SZ_SM, background: GRAD_CTA }} ico={<SpinIco />} label="Enviando…" tag="loading · sm" />
        <GBtn s={{ ...SZ_SM, ...ST_SUCCESS }} ico={<ChkIco />} label="Pronto" tag="success · sm" />
        <GBtn s={{ ...SZ_SM, ...ST_DISABLED }} label="Inativo" tag="disabled · sm" />
      </GRow>

      <GHead>③ danger — destrutivo (Apagar conta) · estados</GHead>
      <GRow>
        <GBtn s={{ ...SZ_MD, background: '#e5484d' }} label="Apagar conta" tag="idle" />
        <GBtn s={{ ...SZ_MD, background: '#e5484d' }} ico={<SpinIco />} label="Apagando…" tag="loading" />
        <GBtn s={{ ...SZ_MD, ...ST_SUCCESS }} ico={<ChkIco />} label="Apagado" tag="success" />
        <GBtn s={{ ...SZ_MD, ...ST_DISABLED }} label="Apagar conta" tag="disabled" />
      </GRow>

      <GHead>④ ghost — secundário / cancelar · md + sm</GHead>
      <GRow>
        <GBtn s={{ ...SZ_MD, background: 'rgba(255,255,255,0.06)', color: '#F5F5F7' }} label="Cancelar" tag="ghost · md" />
        <GBtn s={{ ...SZ_SM, background: 'rgba(255,255,255,0.06)', color: '#F5F5F7' }} label="Cancelar" tag="ghost · sm" />
        <GBtn s={{ ...SZ_MD, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }} label="Cancelar" tag="ghost · disabled" />
      </GRow>

      <GHead>↳ MESCLAM no Button canônico (hoje são componentes/estilos separados)</GHead>
      <GRow>
        <GBtn s={{ ...SZ_MD, background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)' }} ico={<SpinIco />} label="Enviando…" tag="MotionStateButton (roxo + estados) → primary" />
        <GBtn s={{ fontSize: 16, padding: '0 26px', height: 50, minWidth: 170, background: GRAD_CTA }} label="Continuar" tag="AuthStateButton (full · 16px) → primary lg" />
        <GBtn s={{ ...SZ_MD, background: GRAD_CTA }} label="Meu Fanverse" tag="Navbar ctaPill → primary" />
        <GBtn s={{ ...SZ_MD, background: 'rgba(168,85,247,0.18)', color: '#F5F5F7', border: '1px solid rgba(168,85,247,0.45)' }} label="Participar" tag="primaryCta / joinPill (roxo transl.) → ghost/tonal" />
        <GBtn s={{ ...SZ_MD, background: 'rgba(168,85,247,0.22)', color: '#F5F5F7', border: '1px solid rgba(168,85,247,0.5)' }} label="Resolver" tag="Quiz solveBtn → ghost/tonal" />
        <GBtn s={{ ...SZ_MD, background: '#3ddb74', color: '#061110' }} label="Confirmar" tag="ConfirmDialog (verde) → primary ou variante confirm?" />
        <GBtn s={{ ...SZ_MD, background: '#F5F5F7', color: '#08080A' }} label="Entrar" tag="TopBar btnPrimaryWhite → variante light?" />
      </GRow>

      <GHead>↳ MANTÊM como variação própria (não viram o pill)</GHead>
      <GRow>
        <RC tag="HeartButton · normal (cinza, preenchido)"><Heart fill="rgba(245,245,247,0.55)" color="rgba(245,245,247,0.55)" /></RC>
        <RC tag="HeartButton · curtido (#ec4899)"><Heart fill="#ec4899" color="#ec4899" /></RC>
        <RC tag="addBtn · ícone (+) verde"><span style={{ width: 30, height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(61,219,116,0.12)', border: '1px solid rgba(61,219,116,0.45)', color: '#3ddb74', fontSize: 16 }}>+</span></RC>
        <RC tag="closeBtn / backBtn · ícone utilitário"><span style={{ width: 30, height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(245,245,247,0.7)', fontSize: 13 }}>✕</span></RC>
        <RC tag="FAB Nova comunidade · grad-tri"><span style={{ width: 46, height: 46, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f97316,#ec4899,#9333ea)', color: '#fff', fontSize: 22 }}>+</span></RC>
      </GRow>
      <GRow>
        <RC tag="Tabs pill (Comunidades) — modelo A · mantido">
          <span style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>
            <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 12, fontWeight: 600 }}>Geral</span>
            <span style={{ padding: '6px 12px', borderRadius: 999, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Shows</span>
          </span>
        </RC>
        <RC tag="Tabs underline (Fanpoints) — modelo B · mantido">
          <span style={{ display: 'inline-flex', gap: 14 }}>
            <span style={{ paddingBottom: 6, color: '#fff', fontSize: 12, fontWeight: 600, borderBottom: '2px solid #a78bfa' }}>Conquistas</span>
            <span style={{ paddingBottom: 6, color: 'rgba(245,245,247,0.55)', fontSize: 12, fontWeight: 500 }}>Benefícios</span>
          </span>
        </RC>
      </GRow>
    </div>
  );
}

const REPROS: Record<string, ReactNode> = {
  'Sem botão canônico': <ButtonGallery />,
  'Duas CTAs assinatura diferentes': (
    <>
      <RC tag="✓ PADRÃO · linear-gradient(90deg, #ff00b4, #5b00d1)">
        <span style={{ ...btnBase, padding: '16px 30px', fontSize: 15, background: 'linear-gradient(90deg, #ff00b4 0%, #5b00d1 50%, #ff00b4 100%)' }}>Meu Fanverse</span>
      </RC>
      <RC tag="✕ REMOVER · 135° roxo→rosa (--grad-cta-app)">
        <span style={{ ...btnBase, padding: '16px 30px', fontSize: 15, background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', opacity: 0.38, textDecoration: 'line-through' }}>Confirmar</span>
      </RC>
    </>
  ),
  'FeedPanel sequestra o verde da marca': (
    <>
      <RC tag="--accent (marca) · #3DDB74">
        <span style={{ width: 96, height: 56, borderRadius: 10, background: '#3DDB74' }} />
      </RC>
      <RC tag="FeedPanel sobrescreve --accent · #ff2e9a">
        <span style={{ width: 96, height: 56, borderRadius: 10, background: '#ff2e9a' }} />
      </RC>
      <RC tag="FeedPanel --accent2 · #a855f7">
        <span style={{ width: 96, height: 56, borderRadius: 10, background: '#a855f7' }} />
      </RC>
    </>
  ),
  'Cards ad-hoc por feature': (
    <>
      <RC tag="✓ ActivityCard → estilo SameTrackToast (pill r999 + blur)">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 8px', borderRadius: 999, background: 'linear-gradient(160deg, rgba(6,6,14,0.96), rgba(4,4,10,0.96))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.7)' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#3a3a44,#1c1c22)' }} />
          <span style={{ fontSize: 12, color: 'rgba(245,245,247,0.65)' }}>Ana C. <strong style={{ color: '#fff' }}>curtiu</strong></span>
        </span>
      </RC>
      <RC tag="✓ QuizPost/MediaPost · r6 (era r16)">
        <span style={{ display: 'block', width: 170, borderRadius: 6, background: 'linear-gradient(145deg, rgba(5,3,8,0.92), rgba(3,2,5,0.9))', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 0 0 1px rgba(168,85,247,0.15), 0 8px 32px rgba(0,0,0,0.55)', padding: '12px 13px' }}>
          <span style={{ fontSize: 13, color: 'rgba(245,245,247,0.85)', fontWeight: 600 }}>Enquete / mídia</span>
        </span>
      </RC>
      <RC tag="PostCard (blog) · r8 · mantido">
        <span style={{ display: 'block', width: 150, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: 56, background: 'linear-gradient(135deg,#1c1c1c,#0c0c0c)' }} />
          <span style={{ display: 'block', padding: 10, fontSize: 13, color: 'rgba(255,255,255,0.92)', fontWeight: 700 }}>Título do post</span>
        </span>
      </RC>
    </>
  ),
  'Badges / pills sem padrão': (
    <>
      <RC tag="✓ VerifiedBadge · mantido">
        <Verified />
      </RC>
      <RC tag="✓ PADRÃO pill · branco r999 (UserPicker addBtn)">
        <span style={{ display: 'inline-flex', padding: '6px 14px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 12, fontWeight: 600 }}>Adicionar</span>
      </RC>
      <RC tag="✓ joinPill → segue o padrão branco">
        <span style={{ display: 'inline-flex', padding: '6px 14px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 12, fontWeight: 600 }}>Participar</span>
      </RC>
      <RC tag="✕ REMOVER · LiveBadge + StatsPill">
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', opacity: 0.38 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 40, background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3DDB74' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7' }}>AO VIVO</span>
          </span>
          <span style={{ display: 'inline-flex', padding: '8px 20px', borderRadius: 999, background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#A1A1AA' }}>
            <strong style={{ color: '#F5F5F7' }}>1.2k</strong>
          </span>
        </span>
      </RC>
    </>
  ),
  'Sem componente de Avatar': (
    <>
      {[32, 36, 40, 42, 56, 64].map((size) => {
        const dot = Math.max(8, Math.round(size * 0.26));
        return (
          <RC key={size} tag={`${size}px${size === 40 ? ' · padrão' : ''}`}>
            <span style={avatarCircle(size, '1px solid rgba(255,255,255,0.12)')}>
              <span style={{ position: 'absolute', bottom: -1, right: -1, width: dot, height: dot, borderRadius: '50%', background: '#22c55e', border: '1.5px solid #0a0a14', boxShadow: '0 0 6px rgba(34,197,94,0.55)' }} />
            </span>
          </RC>
        );
      })}
    </>
  ),
  'Tabs em dois modelos': (
    <>
      <RC tag="FilterTabs · ativo = pill branco em container blur">
        <span style={{ display: 'inline-flex', gap: 8, padding: 5, borderRadius: 999, background: 'rgba(8,8,10,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ padding: '8px 18px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 12, fontWeight: 600 }}>Todos</span>
          <span style={{ padding: '8px 18px', borderRadius: 999, color: '#71717A', fontSize: 12, fontWeight: 600 }}>Perto</span>
        </span>
      </RC>
      <RC tag="ArtistBox · ativo = pill translúcido r8">
        <span style={{ display: 'inline-flex', gap: 1, padding: 2, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
          <span style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 600 }}>Missões</span>
          <span style={{ padding: '6px 14px', borderRadius: 8, color: 'rgba(245,245,247,0.55)', fontSize: 12, fontWeight: 600 }}>Ranking</span>
        </span>
      </RC>
    </>
  ),
  '4 toasts independentes': (
    <>
      <RC tag="✓ PADRÃO = casca do SameTrackToast (pill r999 + blur)">
        <span style={{ ...toastShell, gap: 10, padding: '8px 14px 8px 8px', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.7), 0 0 18px -4px rgba(61,219,116,0.25)' }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3a3a44,#1c1c22)', border: '1.5px solid rgba(255,255,255,0.2)' }} />
          <span style={{ color: 'rgba(245,245,247,0.65)' }}><strong style={{ color: '#fff' }}>João</strong> ouvindo Boiadeira</span>
        </span>
      </RC>
      <RC tag="Sucesso · mesma casca + check">
        <span style={toastShell}><Check /> Salvo com sucesso</span>
      </RC>
      <RC tag="Pontos · mesma casca + estrela">
        <span style={toastShell}><Star /> <strong style={{ color: '#fff' }}>+50</strong> fanpoints</span>
      </RC>
      <RC tag="Conquista · mesma casca + avatar">
        <span style={{ ...toastShell, gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3a3a44,#1c1c22)' }} />
          <span><strong style={{ color: '#fff' }}>Ana C.</strong> novo <strong style={{ color: '#3ddb74' }}>marco</strong></span>
        </span>
      </RC>
    </>
  ),
  'Paleta roxo/rosa não tokenizada': (
    <>
      {[
        ['#9333ea', '✓ PADRÃO roxo', false],
        ['#ec4899', '✓ PADRÃO rosa', false],
        ['#a855f7', '✕ → #9333ea', true],
        ['#c084fc', '✕ → #9333ea', true],
        ['#d946ef', '✕ → #ec4899', true],
        ['#f472b6', '✕ → #ec4899', true],
        ['#f97316', 'laranja (grad-tri)', false],
      ].map(([hex, label, removed]) => (
        <RC key={hex as string} tag={`${hex} · ${label}`}>
          <span style={{ width: 64, height: 48, borderRadius: 10, background: hex as string, border: '1px solid rgba(255,255,255,0.08)', opacity: removed ? 0.32 : 1, filter: removed ? 'grayscale(0.4)' : 'none' }} />
        </RC>
      ))}
    </>
  ),
  'Raios de pill/card variados': (
    <>
      {[
        ['999px', '✓ PADRÃO pill/círculo', false],
        ['8px', '✓ PADRÃO card', false],
        ['6px', 'QuizPost/Media (decidido)', false],
        ['50%', '✕ → 999px', true],
        ['12px', '✕ remover', true],
        ['16px', '✕ remover', true],
        ['18px', '✕ remover', true],
      ].map(([r, label, removed]) => (
        <RC key={label as string} tag={`${r} · ${label}`}>
          <span style={{ width: 64, height: 48, borderRadius: r as string, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', opacity: removed ? 0.32 : 1 }} />
        </RC>
      ))}
    </>
  ),
  'Sem escala tipográfica adotada': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#F5F5F7' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#82828e' }}>
        Escala decidida: 12 (mín) · 14 · 16 · 18 · 22 · 28 — removidos 12.5/13/13.5→12 e 15
      </span>
      {[12, 14, 16, 18, 22, 28].map((s) => (
        <span key={s} style={{ fontSize: s, lineHeight: 1.15 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#82828e', marginRight: 10 }}>{s}px</span>
          O lugar do superfã
        </span>
      ))}
    </div>
  ),
  'Densidade inconsistente': (
    <>
      {[
        ['12px 16px', '✓ grid 4px (12×16)', false],
        ['10px 12px', '✕ 10×12 → 12×12', true],
        ['12px 14px', '✕ 12×14 → 12×16', true],
        ['8px 14px', '✕ 8×14 → 8×16', true],
        ['10px 16px', '✕ 10×16 → 12×16', true],
      ].map(([pad, label, off]) => (
        <RC key={label as string} tag={label as string}>
          <span style={{ display: 'inline-block', padding: pad as string, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F5F5F7', fontSize: 13, opacity: off ? 0.4 : 1 }}>Item</span>
        </RC>
      ))}
    </>
  ),
  'Empty / error states só texto': (
    <>
      <RC tag="✕ hoje · só texto">
        <span style={{ display: 'grid', placeItems: 'center', width: 200, height: 90, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(245,245,247,0.45)', fontSize: 13 }}>Sem resultados</span>
      </RC>
      <RC tag="✓ PADRÃO · ícone + texto + ação">
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 200, height: 90, justifyContent: 'center', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 12, color: 'rgba(245,245,247,0.6)' }}>Nada por aqui</span>
          <span style={{ fontSize: 11, color: '#3ddb74', fontWeight: 600 }}>Adicionar</span>
        </span>
      </RC>
    </>
  ),
  'Breakpoints fragmentados': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#82828e' }}>
        Mapa de referência — todos mantidos (cada um foi colocado de propósito)
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {[480, 560, 600, 640, 720, 768, 880, 900, 1024, 1100].map((bp) => (
          <span key={bp} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'rgba(245,245,247,0.7)' }}>
            {bp}px
          </span>
        ))}
      </div>
    </div>
  ),
  'Reduced-motion incompleto': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#82828e' }}>
        useReducedMotion respeitado nos componentes de motion
      </span>
      {[
        ['MotionSwitch', '✓ implementado'],
        ['NumberTicker', '✓ implementado'],
        ['ModalShell · listas · toasts', '✓ já respeitavam'],
        ['MotionStateButton', '— sai na padronização de botões'],
      ].map(([name, state]) => (
        <span key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'rgba(245,245,247,0.7)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{name}</span>
          <span style={{ color: state.startsWith('✓') ? '#3ddb74' : 'rgba(245,245,247,0.4)' }}>{state}</span>
        </span>
      ))}
    </div>
  ),
};

function AuditoriaSection() {
  const order: Sev[] = ['alta', 'média', 'baixa'];
  const pending = [...PENDING].sort((a, b) => order.indexOf(a.sev!) - order.indexOf(b.sev!));
  const counts = {
    alta: pending.filter((p) => p.sev === 'alta').length,
    média: pending.filter((p) => p.sev === 'média').length,
    baixa: pending.filter((p) => p.sev === 'baixa').length,
  };

  return (
    <div className={styles.section}>
      <p className={styles.sectionLead}>
        Catálogo de <strong>inconsistências visuais</strong> da plataforma, pra
        você avaliar item a item e decidir o que implementar. O P0 já resolveu a
        base (byte-idêntico, no ar); o resto está pendente com{' '}
        <strong>severidade · esforço · recomendação</strong>. Nada aqui foi
        aplicado ainda — é a sua lista de decisão.
      </p>

      <div className={styles.notice} style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <span>
          <strong>{RESOLVED.length} resolvido no P0</strong> · {pending.length} pendente
          {' '}({counts.alta} alta, {counts.média} média, {counts.baixa} baixa severidade).
          Severidade = impacto visual/consistência. Esforço = tamanho da implementação.
          Tudo pendente <strong>muda pixels</strong> → exige QA no /app (agora possível).
        </span>
      </div>

      {/* Resolvido no P0 */}
      <Card>
        <CardHeader
          title="✅ Resolvido no P0"
          description="Tokenização byte-idêntica, já no ar (zero mudança visual)"
          actions={<Badge tone="success">{RESOLVED.length}</Badge>}
        />
        <CardBody>
          <div className={styles.audit}>
            {RESOLVED.map((a) => (
              <div key={a.title} className={styles.auditItem} style={{ borderLeftColor: 'var(--brand)' }}>
                <div className={styles.auditBody}>
                  <span className={styles.auditTitle}>
                    {a.title}
                    <CatTag>{a.cat}</CatTag>
                    <Badge tone="success" size="sm">resolvido</Badge>
                  </span>
                  <span className={styles.auditDesc}>{a.desc}</span>
                  <span className={styles.auditWhere}>{a.where} — {a.via}</span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Pendente — decisão */}
      <Card>
        <CardHeader
          title="Pendente — avalie e decida"
          description="Cada item muda pixels; recomendação + esforço pra você priorizar"
          actions={<Badge tone="warning">{pending.length}</Badge>}
        />
        <CardBody>
          <div className={styles.audit}>
            {pending.map((a) => (
              <div
                key={a.title}
                className={styles.auditItem}
                style={{ borderLeftColor: SEV_BORDER[a.sev!] }}
              >
                <div className={styles.auditBody}>
                  <span className={styles.auditTitle}>
                    {a.title}
                    <CatTag>{a.cat}</CatTag>
                    <Badge tone={SEV_TONE[a.sev!]} size="sm">severidade {a.sev}</Badge>
                    <Badge tone="neutral" size="sm">esforço {a.eff}</Badge>
                  </span>
                  <span className={styles.auditDesc}>{a.desc}</span>
                  <span className={styles.auditWhere}>{a.where}</span>
                  <span
                    className={styles.auditDesc}
                    style={{ color: 'var(--text)', marginTop: 2 }}
                  >
                    <strong style={{ color: 'var(--brand)' }}>Recomendação: </strong>
                    {a.rec}
                  </span>
                  {REPROS[a.title] && (
                    <div className={styles.reproStage}>{REPROS[a.title]}</div>
                  )}
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
