import { api } from './api';
import type {
  AlgorithmActionKind,
  AlgorithmCatalogEntry,
  AlgorithmRule,
  AlgorithmRuleInput,
  AlgorithmTriggerEvent,
} from '@/types';

/* ── Catalog (must mirror server/algorithm/rules.ts) ───────────
 *
 * Kept hand-rolled in the client so the composer can render its
 * fields without an extra round-trip. The server is the source of
 * truth — any divergence is a bug. If we ever swap to fetching
 * this from the API, the composer's wire format stays the same.
 */

export const TRIGGER_CATALOG: Record<AlgorithmTriggerEvent, AlgorithmCatalogEntry> = {
  session_started: {
    label: 'Início de sessão',
    helper: 'Dispara quando o usuário inicia uma sessão no app.',
    fields: {},
  },
  idle_in_screen: {
    label: 'Inatividade em tela',
    helper: 'Dispara quando o usuário fica parado em uma tela por X segundos.',
    fields: {
      screen: {
        kind: 'enum',
        label: 'Tela',
        helper: 'Qual tela é monitorada. "Qualquer" cobre todo /app.',
        options: ['any', 'feed', 'chat', 'profile', 'player'],
        defaultValue: 'any',
      },
      seconds: {
        kind: 'number',
        label: 'Segundos de inatividade',
        helper: 'Quantos segundos sem interação antes de disparar.',
        defaultValue: 30,
        min: 5,
        max: 600,
      },
    },
  },
  feed_scroll_streak: {
    label: 'Streak de scroll no feed',
    helper: 'Dispara quando o usuário passa X posts sem curtir/comentar.',
    fields: {
      count: {
        kind: 'number',
        label: 'Posts consecutivos',
        helper: 'Quantos posts passar sem engajar antes de disparar.',
        defaultValue: 10,
        min: 3,
        max: 50,
      },
    },
  },
  track_completed: {
    label: 'Faixa concluída',
    helper: 'Dispara quando o usuário escuta uma faixa até o fim.',
    fields: {},
  },
  track_skipped: {
    label: 'Faixa pulada',
    helper: 'Dispara quando o usuário pula uma faixa antes de terminar.',
    fields: {},
  },
  time_in_app_minutes: {
    label: 'Tempo no app',
    helper: 'Dispara após Y minutos contínuos no app.',
    fields: {
      minutes: {
        kind: 'number',
        label: 'Minutos',
        helper: 'Tempo em minutos antes de disparar.',
        defaultValue: 15,
        min: 1,
        max: 240,
      },
    },
  },
  consecutive_inactive_days: {
    label: 'Dias inativos',
    helper: 'Dispara quando o usuário volta após N dias sem entrar.',
    fields: {
      days: {
        kind: 'number',
        label: 'Dias sem entrar',
        helper: 'Mínimo de dias inativos antes do retorno disparar.',
        defaultValue: 3,
        min: 1,
        max: 60,
      },
    },
  },
};

export const ACTION_CATALOG: Record<AlgorithmActionKind, AlgorithmCatalogEntry> = {
  show_toast: {
    label: 'Mostrar toast',
    helper: 'Mensagem flutuante curta. Boa para nudges leves.',
    fields: {
      title: {
        kind: 'string',
        label: 'Título',
        helper: 'Curto (até 60 chars).',
        defaultValue: '',
        maxLength: 60,
      },
      body: {
        kind: 'string',
        label: 'Mensagem',
        helper: 'Texto principal exibido.',
        defaultValue: '',
        maxLength: 240,
      },
      cta_label: {
        kind: 'string',
        label: 'Texto do botão (opcional)',
        helper: 'Deixe vazio para toast sem ação.',
        defaultValue: '',
        maxLength: 30,
      },
      cta_url: {
        kind: 'string',
        label: 'URL/rota do botão (opcional)',
        helper: 'Aceita rotas internas (/app/feed) ou URLs externas.',
        defaultValue: '',
        maxLength: 200,
      },
    },
  },
  nudge_to_screen: {
    label: 'Sugerir tela',
    helper: 'Empurra o usuário para uma tela específica via micro-prompt.',
    fields: {
      screen: {
        kind: 'enum',
        label: 'Tela alvo',
        helper: 'Para onde direcionar.',
        options: ['feed', 'chat', 'profile', 'player'],
        defaultValue: 'feed',
      },
      message: {
        kind: 'string',
        label: 'Mensagem',
        helper: 'Frase curta exibida no nudge.',
        defaultValue: 'Tem novidade aqui',
        maxLength: 80,
      },
    },
  },
  inject_recommendation: {
    label: 'Injetar recomendação',
    helper: 'Adiciona um item recomendado ao feed/player do usuário.',
    fields: {
      kind: {
        kind: 'enum',
        label: 'Tipo de recomendação',
        helper: 'Qual lógica de recomendação aplicar.',
        options: ['similar_track', 'popular_post', 'superfan', 'new_creator'],
        defaultValue: 'similar_track',
      },
    },
  },
  show_modal: {
    label: 'Mostrar modal',
    helper: 'Diálogo bloqueante com até 2 CTAs. Use com parcimônia.',
    fields: {
      title: {
        kind: 'string',
        label: 'Título',
        helper: '',
        defaultValue: '',
        maxLength: 80,
      },
      body: {
        kind: 'string',
        label: 'Corpo',
        helper: '',
        defaultValue: '',
        maxLength: 500,
      },
      primary_cta: {
        kind: 'string',
        label: 'CTA primário',
        helper: 'Texto do botão principal.',
        defaultValue: 'OK',
        maxLength: 30,
      },
      primary_url: {
        kind: 'string',
        label: 'URL do CTA primário (opcional)',
        helper: '',
        defaultValue: '',
        maxLength: 200,
      },
      secondary_cta: {
        kind: 'string',
        label: 'CTA secundário (opcional)',
        helper: 'Deixe vazio para apenas um botão.',
        defaultValue: '',
        maxLength: 30,
      },
    },
  },
};

/** Pre-fill an empty config object with the defaults declared in
 *  the catalog. Used when the admin first picks a trigger/action
 *  or switches mid-edit. */
export function defaultConfigFor(
  entry: AlgorithmCatalogEntry,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(entry.fields)) {
    out[key] = field.defaultValue;
  }
  return out;
}

/* ── Service ─────────────────────────────────────────────────── */

interface ListArgs {
  search?: string;
  triggerEvent?: AlgorithmTriggerEvent | 'all';
  actionKind?: AlgorithmActionKind | 'all';
  enabled?: 'true' | 'false' | 'all';
  limit?: number;
  offset?: number;
}

export const algorithmService = {
  list: async (args: ListArgs = {}): Promise<{ items: AlgorithmRule[]; total: number }> => {
    const params = new URLSearchParams();
    if (args.search)        params.set('search',       args.search);
    if (args.triggerEvent)  params.set('triggerEvent', args.triggerEvent);
    if (args.actionKind)    params.set('actionKind',   args.actionKind);
    if (args.enabled)       params.set('enabled',      args.enabled);
    if (args.limit)         params.set('limit',        String(args.limit));
    if (args.offset)        params.set('offset',       String(args.offset));
    const qs = params.toString();
    return api.get(`/api/admin/algorithm-rules${qs ? `?${qs}` : ''}`);
  },
  get: (id: string): Promise<AlgorithmRule> => api.get(`/api/admin/algorithm-rules/${id}`),
  create: (input: AlgorithmRuleInput): Promise<AlgorithmRule> =>
    api.post('/api/admin/algorithm-rules', input),
  update: (id: string, input: AlgorithmRuleInput): Promise<AlgorithmRule> =>
    api.patch(`/api/admin/algorithm-rules/${id}`, input),
  remove: (id: string): Promise<{ ok: true }> =>
    api.delete(`/api/admin/algorithm-rules/${id}`),
};
