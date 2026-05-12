'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  IconHeart,
  IconUsers,
  IconChevronRight,
  IconFeed,
  IconCircle,
} from '@/components/icons';
import {
  engagementService,
  type EngagementSnapshot,
} from '@/services/engagement';
import { formatCompact, formatNumber } from '@/lib/format';
import styles from './page.module.css';

/* ── Inline trend chart ───────────────────────────────
 * Small purposeful copy of the dashboard's LineChart — engagement
 * has a single series (daily message volume), so we render it
 * directly without dragging the dashboard's polymorphic component
 * into this page. Same visual language: gradient area + line.
 * ────────────────────────────────────────────────────── */
function MessagesTrend({ data }: { data: { day: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <div style={{ height: 180, display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}>
        Sem mensagens nos últimos 30 dias.
      </div>
    );
  }
  const w = 600;
  const h = 180;
  const padX = 16;
  const padY = 14;
  const values = data.map((d) => d.count);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;

  const linePath = data
    .map((p, i) => {
      const x = padX + i * stepX;
      const y = padY + (h - padY * 2) * (1 - (p.count - min) / range);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const areaPath = `${linePath} L ${(padX + (data.length - 1) * stepX).toFixed(2)},${h - padY} L ${padX},${h - padY} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => padY + (h - padY * 2) * p);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={h}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="engagement-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand, #4F46E5)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand, #4F46E5)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((y, i) => (
        <line
          key={i}
          x1={padX}
          x2={w - padX}
          y1={y}
          y2={y}
          stroke="var(--border-soft)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}
      <path d={areaPath} fill="url(#engagement-area)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--brand, #4F46E5)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Page ──────────────────────────────────────────── */

export default function EngagementPage() {
  const [snap, setSnap] = useState<EngagementSnapshot | null>(null);

  useEffect(() => {
    engagementService
      .get()
      .then(setSnap)
      .catch((err) => {
        console.error('engagementService.get failed:', err);
        // Empty snapshot so KPIs render zeros instead of staying in skeleton.
        setSnap({
          totalMessages: 0,
          totalReactions: 0,
          chatsStarted: 0,
          superchatParticipants: 0,
          messagesPerDay: [],
        });
      });
  }, []);

  return (
    <>
      <PageHeader
        title="Engajamento"
        description="Indicadores que mensuram como os usuários estão se relacionando dentro da plataforma — conversas, navegação no mapa e participação."
      />

      <div className={styles.body}>
        {/* ── Conversas ─────────────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Conversas <span>Mensagens, reações e Superchat</span>
          </div>

          <div className={styles.kpiGrid}>
            <StatCard
              label="Mensagens trocadas"
              value={snap ? formatCompact(snap.totalMessages) : '—'}
              icon={<IconFeed size={14} />}
              trendLabel="DMs + Superchat combinados"
            />
            <StatCard
              label="Reações no Superchat"
              value={snap ? formatCompact(snap.totalReactions) : '—'}
              icon={<IconHeart size={14} />}
              trendLabel="Toggles em message_reactions"
            />
            <StatCard
              label="Conversas iniciadas"
              value={snap ? formatNumber(snap.chatsStarted) : '—'}
              icon={<IconFeed size={14} />}
              trendLabel="Atividades kind = chat_started"
            />
            <StatCard
              label="Participantes do Superchat"
              value={snap ? formatNumber(snap.superchatParticipants) : '—'}
              icon={<IconUsers size={14} />}
              trendLabel="Usuários joinados na sala global"
            />
          </div>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>
              <div>
                <div className={styles.chartTitle}>Mensagens por dia</div>
                <div className={styles.chartSubtitle}>
                  Volume de mensagens trocadas — últimos 30 dias
                </div>
              </div>
            </div>
            <div className={styles.chartBody}>
              <MessagesTrend data={snap?.messagesPerDay ?? []} />
            </div>
          </Card>
        </div>

        {/* ── Navegação no mapa (placeholder) ─────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Navegação no mapa <span>Exploração e interações</span>
          </div>
          <div className={styles.placeholderGrid}>
            <div className={styles.comingSoon}>
              <span className={styles.comingSoonLabel}>Em breve</span>
              <div className={styles.comingSoonTitle}>Tempo de exploração</div>
              <p className={styles.comingSoonDesc}>
                Tempo médio que cada usuário passa explorando o mapa por sessão.
                Pendente instrumentação no cliente (registro de mousemove/zoom
                em intervalos discretos).
              </p>
            </div>
            <div className={styles.comingSoon}>
              <span className={styles.comingSoonLabel}>Em breve</span>
              <div className={styles.comingSoonTitle}>Pins visitados</div>
              <p className={styles.comingSoonDesc}>
                Contagem de cliques em pins de outros usuários — proxy de
                descoberta social. Pendente novo evento <code>map:pin:click</code>
                no socket.
              </p>
            </div>
            <div className={styles.comingSoon}>
              <span className={styles.comingSoonLabel}>Em breve</span>
              <div className={styles.comingSoonTitle}>Interações com perfis</div>
              <p className={styles.comingSoonDesc}>
                Quantas vezes usuários abrem o painel de outro perfil pra ver
                histórico, fanpoints, etc. Já temos a UI; falta capturar o evento
                de abertura.
              </p>
            </div>
            <div className={styles.comingSoon}>
              <span className={styles.comingSoonLabel}>Em breve</span>
              <div className={styles.comingSoonTitle}>Heatmap horário/dia</div>
              <p className={styles.comingSoonDesc}>
                Visualização de pico de atividade por hora × dia da semana —
                útil pra decidir quando empurrar conteúdo. Vai consumir o evento
                de exploração assim que ele estiver vivo.
              </p>
            </div>
          </div>
        </div>

        {/* ── Comunidades (placeholder) ─────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Comunidades <span>A desenvolver</span>
          </div>
          <div className={styles.comingSoon}>
            <span className={styles.comingSoonLabel}>Em breve</span>
            <div className={styles.comingSoonTitle}>
              <IconCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
              Métricas de comunidades
            </div>
            <p className={styles.comingSoonDesc}>
              Feature ainda a ser desenvolvida — a estrutura abaixo já está
              prevista para receber os indicadores assim que o domínio for
              modelado no banco:
            </p>
            <ul className={styles.comingSoonList}>
              <li>Participação em comunidades (joined / active)</li>
              <li>Posts, comentários e reações por comunidade</li>
              <li>Frequência de acesso (DAU/WAU por comunidade)</li>
              <li>Top contribuidores e moderadores</li>
            </ul>
          </div>
        </div>

        {/* ── Próximos passos ─────────────────────────── */}
        <Card>
          <CardHeader
            title="Como esta página vai crescer"
            description="A estrutura é escalável — cada métrica nova entra como um StatCard adicional, sem refactor."
          />
          <div style={{ padding: '0 18px 18px', fontSize: 12.5, color: 'var(--text-mute)', lineHeight: 1.7 }}>
            <p>
              <strong style={{ color: 'var(--text)' }}>Fluxo planejado:</strong>{' '}
              novos eventos do cliente (exploração de mapa, abertura de perfil) caem
              em uma nova tabela <code>engagement_events</code>. O endpoint
              <code> /api/admin/engagement</code> agrega esses eventos e os devolve
              ao lado dos KPIs atuais. Visualizações sugeridas: gráficos de linha
              (tendências), KPIs absolutos (já presentes), heatmaps (hora × dia) e
              rankings (top contribuidores).
            </p>
            <p style={{ marginTop: 8 }}>
              <IconChevronRight size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
              <span style={{ marginLeft: 4 }}>
                Adicionar tabela <code>engagement_events</code> + endpoints de
                ingestão é o próximo passo natural pra fechar essa página.
              </span>
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
