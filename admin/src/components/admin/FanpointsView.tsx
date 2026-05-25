'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Table, { type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import {
  fanpointsService,
  type FanpointRule as ServerFanpointRule,
  type FanpointRuleKind,
} from '@/services/fanpoints';
import {
  CATEGORY_LABEL as FANPOINT_CATEGORY_LABEL,
  loadFanpointRules as loadBrainstormRules,
  type FanpointCategory,
  type FanpointRule as BrainstormRule,
} from '@/data/mock/fanpoints';
import { formatRelative } from '@/lib/format';
import styles from './FanpointsView.module.css';

/* ============================================================
   Fanpoints — view extraída de Configurações pra rota dedicada
   /fanpoints (sob Superfãs na nova IA).

   Duas seções:
     1. Integrado  — as 7 ActivityKinds reais do backend. Edita
        pontos; persiste em runtime via PATCH.
     2. Brainstorm — wishlist (read-only).
   ============================================================ */

const FANPOINT_CATEGORY_TONE: Record<FanpointCategory, BadgeTone> = {
  playback:   'info',
  social:     'brand',
  engagement: 'success',
  events:     'warning',
  first_time: 'neutral',
};

interface IntegratedKindMeta {
  label: string;
  description: string;
  category: FanpointCategory;
}

const INTEGRATED_KIND_META: Record<FanpointRuleKind, IntegratedKindMeta> = {
  stream: {
    label: 'Reprodução de faixa',
    description: 'Cada play registrado no ledger. Por padrão vale 0 — o bônus real vem em "Cada 3 streams".',
    category: 'playback',
  },
  login: {
    label: 'Login com magic-link',
    description: 'Crédito de retorno: usuário autenticado abre uma nova sessão via link no e-mail.',
    category: 'engagement',
  },
  chat_started: {
    label: 'Iniciar uma DM',
    description: 'Primeira mensagem trocada com um novo fã. Conta uma vez por conversa.',
    category: 'social',
  },
  post_liked: {
    label: 'Curtir um post no feed',
    description: 'Coração em qualquer item do feed (post da Ana, post de fã, single, story).',
    category: 'social',
  },
  comment_posted: {
    label: 'Publicar comentário',
    description: 'Comentário de nível 1 ou resposta em qualquer surface do feed.',
    category: 'social',
  },
  post_shared: {
    label: 'Compartilhar um post',
    description: 'Botão de "send" (share) num post do feed — externo (link copiado) ou interno (DM).',
    category: 'social',
  },
  three_streams: {
    label: 'Cada 3 streams sequenciais',
    description: 'Bônus de engajamento que dispara a cada 3 reproduções acumuladas do usuário.',
    category: 'playback',
  },
};

export default function FanpointsView() {
  const { push } = useToast();
  const [rules, setRules] = useState<ServerFanpointRule[] | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<FanpointRuleKind, number>>>({});
  const [saving, setSaving] = useState<Partial<Record<FanpointRuleKind, boolean>>>({});

  useEffect(() => {
    fanpointsService
      .list()
      .then((res) => setRules(res.items))
      .catch((err) => {
        console.error('fanpointsService.list failed:', err);
        push({
          type: 'error',
          title: 'Falha ao carregar Fanpoints',
          description: 'Tente recarregar a página.',
        });
        setRules([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveRow(rule: ServerFanpointRule, nextPoints: number) {
    if (nextPoints === rule.points) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[rule.kind];
        return next;
      });
      return;
    }
    setSaving((s) => ({ ...s, [rule.kind]: true }));
    try {
      await fanpointsService.save(rule.kind, nextPoints);
      setRules((prev) =>
        prev
          ? prev.map((r) =>
              r.kind === rule.kind
                ? { ...r, points: nextPoints, updatedAt: new Date().toISOString() }
                : r,
            )
          : prev,
      );
      setDrafts((d) => {
        const next = { ...d };
        delete next[rule.kind];
        return next;
      });
      const meta = INTEGRATED_KIND_META[rule.kind];
      push({
        type: 'success',
        title: `${meta.label} → ${nextPoints} pts`,
        description: 'Próximos eventos creditam o novo valor (até 60s pra propagar entre instâncias).',
      });
    } catch (err) {
      console.error('fanpointsService.save failed:', err);
      push({
        type: 'error',
        title: 'Falha ao salvar',
        description: 'O valor anterior foi mantido. Tente novamente.',
      });
    } finally {
      setSaving((s) => {
        const next = { ...s };
        delete next[rule.kind];
        return next;
      });
    }
  }

  const integratedColumns: Column<ServerFanpointRule>[] = [
    {
      id: 'rule',
      header: 'Comportamento',
      sortKey: (r) => INTEGRATED_KIND_META[r.kind].label,
      cell: (r) => {
        const meta = INTEGRATED_KIND_META[r.kind];
        return (
          <div className={styles.fpRuleCell}>
            <span className={styles.fpRuleLabel}>{meta.label}</span>
            <span className={styles.fpRuleKey}>
              <code>{r.kind}</code> · {meta.description}
            </span>
          </div>
        );
      },
    },
    {
      id: 'category',
      header: 'Categoria',
      cell: (r) => {
        const meta = INTEGRATED_KIND_META[r.kind];
        return (
          <Badge tone={FANPOINT_CATEGORY_TONE[meta.category]} size="sm">
            {FANPOINT_CATEGORY_LABEL[meta.category]}
          </Badge>
        );
      },
      width: 140,
    },
    {
      id: 'points',
      header: 'Pontos',
      align: 'right',
      cell: (r) => {
        const draftValue = drafts[r.kind];
        const value = draftValue !== undefined ? draftValue : r.points;
        const dirty = draftValue !== undefined && draftValue !== r.points;
        const isSaving = !!saving[r.kind];
        return (
          <div
            className={styles.fpPointsEditor}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="number"
              className={styles.fpPointsInput}
              value={String(value)}
              disabled={isSaving}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDrafts((d) => ({ ...d, [r.kind]: Number.isFinite(n) ? n : 0 }));
              }}
              onBlur={() => void saveRow(r, value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label={`Pontos para ${INTEGRATED_KIND_META[r.kind].label}`}
            />
            {dirty && <span className={styles.fpPointsHint}>↵</span>}
          </div>
        );
      },
      width: 110,
    },
    {
      id: 'updatedAt',
      header: 'Última edição',
      sortKey: (r) => r.updatedAt,
      cell: (r) => (
        <span className={styles.fpMute}>
          {r.updatedBy
            ? `${formatRelative(r.updatedAt)} · ${r.updatedBy.name ?? r.updatedBy.email}`
            : 'Padrão do sistema'}
        </span>
      ),
      width: 240,
    },
  ];

  const brainstormRules = useMemo(() => loadBrainstormRules(), []);
  const brainstormColumns: Column<BrainstormRule>[] = [
    {
      id: 'rule',
      header: 'Ideia',
      cell: (r) => (
        <div className={styles.fpRuleCell}>
          <span className={styles.fpRuleLabel}>{r.label}</span>
          <span className={styles.fpRuleKey}>
            <code>{r.key}</code> · {r.description}
          </span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Categoria',
      cell: (r) => (
        <Badge tone={FANPOINT_CATEGORY_TONE[r.category]} size="sm">
          {FANPOINT_CATEGORY_LABEL[r.category]}
        </Badge>
      ),
      width: 140,
    },
    {
      id: 'points',
      header: 'Pontos sugeridos',
      align: 'right',
      cell: (r) => (
        <span className={r.points >= 0 ? styles.fpPointsPositive : styles.fpPointsNegative}>
          {r.points >= 0 ? '+' : ''}
          {r.points}
        </span>
      ),
      width: 130,
    },
    {
      id: 'cap',
      header: 'Cap sugerido',
      align: 'right',
      cell: (r) => (
        <span className={styles.fpDailyCap}>{r.dailyCap === 0 ? '—' : r.dailyCap}</span>
      ),
      width: 110,
    },
  ];

  return (
    <div className={styles.fpStack}>
      <Card>
        <CardHeader
          title="Integrado"
          description="Comportamentos que JÁ creditam Fanpoints em runtime. Edite o valor diretamente na coluna 'Pontos' — Enter ou clique fora pra salvar. As mudanças entram em vigor no próximo evento processado (até 60s pra propagar entre instâncias do servidor)."
        />
        <Table<ServerFanpointRule>
          columns={integratedColumns}
          data={rules ?? []}
          rowId={(r) => r.kind}
          pageSize={20}
          loading={rules === null}
        />
      </Card>

      <Card className={styles.fpBrainstormCard}>
        <CardHeader
          title={
            <span className={styles.fpBrainstormTitle}>
              <Badge tone="neutral" size="sm">Brainstorm</Badge>
              Próximas regras (não integradas)
            </span>
          }
          description="Wishlist de comportamentos que valeriam Fanpoints. Cada item aqui ainda PRECISA de backend (novo enum em user_activities.kind + emissor no código). Edite o valor sugerido quando um usuário pedir, e quando implementar passe pra seção Integrado acima."
        />
        <Table<BrainstormRule>
          columns={brainstormColumns}
          data={brainstormRules}
          rowId={(r) => r.id}
          pageSize={20}
        />
      </Card>
    </div>
  );
}
