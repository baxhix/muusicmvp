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
    desc: 'Não existe um Button(variant, size). CTAs e botões de ação são bespoke por feature — padding, hover, foco, raio e tipografia divergem entre telas. É o elemento mais visível e repetido do app.',
    where: 'MotionStateButton · AuthStateButton · HeartButton · <button> inline',
    sev: 'alta',
    eff: 'alto',
    rec: 'Criar Button em src/components/ui/ e migrar. Maior ganho de consistência visual do app inteiro.',
  },
  {
    cat: 'Cores',
    title: 'Duas CTAs assinatura diferentes',
    desc: 'A landing usa pill magenta→indigo; o app usa roxo→rosa. Duas identidades de CTA convivendo — o usuário vê dois "botões principais" distintos entre landing e produto.',
    where: 'SectionCTA/Navbar (landing) vs MotionStateButton/Auth (app)',
    sev: 'média',
    eff: 'baixo',
    rec: 'Decidir UMA CTA assinatura — ou assumir landing vs app de propósito e documentar.',
  },
  {
    cat: 'Cores',
    title: 'FeedPanel sequestra o verde da marca',
    desc: 'O FeedPanel redefine --accent global para rosa (#ff2e9a) e --accent2 roxo. O "verde Fanverse" vira rosa só nessa superfície — quebra o significado do token.',
    where: 'FeedPanel.module.css',
    sev: 'média',
    eff: 'baixo',
    rec: 'Usar token próprio (--feed-accent) em vez de redefinir a variável global --accent.',
  },
  {
    cat: 'Componentes',
    title: 'Cards ad-hoc por feature',
    desc: 'Não há Card base. Cada superfície define borda/sombra/padding/hover do seu jeito — densidade e elevação inconsistentes entre cards parecidos.',
    where: 'ActivityCard · PostCard · ProfileCardStack + cards inline',
    sev: 'média',
    eff: 'médio',
    rec: 'Card base com variantes; adotar nas features.',
  },
  {
    cat: 'Componentes',
    title: 'Badges / pills sem padrão',
    desc: 'VerifiedBadge, LiveBadge, StatsPill, RankMedallion + pills inline — alturas, raios e cores variados pro mesmo papel de rótulo.',
    where: '8+ módulos com .pill / .badge próprios',
    sev: 'média',
    eff: 'médio',
    rec: 'Badge(tone, size) + tokens de pill (altura/raio/padding).',
  },
  {
    cat: 'Componentes',
    title: 'Tabs em dois modelos',
    desc: 'FilterTabs usa indicador CSS estático; ArtistBox usa pill animado (layoutId). Interação e visual diferentes pro mesmo padrão de abas.',
    where: 'FilterTabs vs ArtistBox/ProfilePanel/FanpointsModal',
    sev: 'média',
    eff: 'baixo',
    rec: 'Padronizar no pill animado (layoutId) em todas as abas.',
  },
  {
    cat: 'Componentes',
    title: 'Sem componente de Avatar',
    desc: '<img> inline com placeholder; tamanho, anel, fallback e o selo de verificado são posicionados caso a caso. Inconsistência de tamanho/borda entre telas.',
    where: 'ArtistBox · UserPicker · CommunityPanel · ranking',
    sev: 'média',
    eff: 'médio',
    rec: 'Avatar(size, status, fallback) com VerifiedBadge composável.',
  },
  {
    cat: 'Componentes',
    title: '4 toasts independentes',
    desc: 'AppToast, PointsToast, SocialAchievementToast e SameTrackToast têm animação, posição e tempo de vida próprios. Quatro estilos de notificação coexistindo.',
    where: 'components/app/*Toast.tsx',
    sev: 'média',
    eff: 'médio',
    rec: 'ToastProvider único + useToast (espelhar o que o admin já tem).',
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
    desc: '≈39 tamanhos em px (incl. frações 12.5/13.5). A escala --text-* já existe (P0) mas os componentes ainda usam px literal — hierarquia inconsistente entre telas.',
    where: '*.module.css (≈150 arquivos)',
    sev: 'média',
    eff: 'alto',
    rec: 'Adotar --text-* por superfície, com QA (muda pixels — snap pro valor mais próximo).',
  },
  {
    cat: 'Cores',
    title: 'Paleta roxo/rosa não tokenizada',
    desc: 'Vários roxos/rosas quase iguais convivem (#a855f7/#9333ea/#c084fc/#d946ef/#ec4899/#f472b6) sem token canônico.',
    where: 'gradientes e fills de vários módulos',
    sev: 'baixa',
    eff: 'médio',
    rec: 'Definir 3–4 roxos canônicos e tokenizar.',
  },
  {
    cat: 'Forma',
    title: 'Raios de pill/card variados',
    desc: '50% e 999px pro mesmo pill; cards em 8/10/12/14/16/18. Cantos inconsistentes entre elementos do mesmo tipo.',
    where: 'UserPicker · FeedPanel · cards diversos',
    sev: 'baixa',
    eff: 'médio',
    rec: 'Snap pra --r-* (e um --pill-radius único).',
  },
  {
    cat: 'Espaçamento',
    title: 'Densidade inconsistente',
    desc: 'Padding de "card" varia (10×12, 12×14, 8×14). A escala --space-* existe (P0) mas não é usada — espaçamento ad-hoc.',
    where: 'QuizPost · UserPicker · CommunityPanel',
    sev: 'baixa',
    eff: 'alto',
    rec: 'Adotar --space-* gradualmente (grid de 4px).',
  },
  {
    cat: 'Estados',
    title: 'Empty / error states só texto',
    desc: 'Estados vazios e de erro são texto puro, sem ícone/ilustração/ação consistentes. Skeleton existe e é bom, mas o resto é ad-hoc.',
    where: 'modais, listas, painéis',
    sev: 'baixa',
    eff: 'médio',
    rec: 'Componente de estado (ícone + texto + ação) reutilizável.',
  },
  {
    cat: 'Responsivo',
    title: 'Breakpoints fragmentados',
    desc: '9 breakpoints distintos (480/560/600/640/720/768/880/900/1024/1100) sem mapa — comportamento responsivo imprevisível entre componentes.',
    where: 'HeroSection · layout · CommunityPanel',
    sev: 'baixa',
    eff: 'alto',
    rec: 'Mapa canônico (sm/md/lg/xl/2xl) via postcss-custom-media + migrar.',
  },
  {
    cat: 'Motion',
    title: 'Reduced-motion incompleto',
    desc: '≈70% das animações respeitam prefers-reduced-motion; faltam checks em MotionStateButton, MotionSwitch e NumberTicker (acessibilidade).',
    where: 'componentes de motion',
    sev: 'baixa',
    eff: 'baixo',
    rec: 'Adicionar useReducedMotion nos componentes faltantes.',
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
