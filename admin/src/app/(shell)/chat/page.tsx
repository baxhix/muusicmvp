'use client';

import { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Switch from '@/components/ui/Switch';
import StatCard from '@/components/ui/StatCard';
import { IconHeart, IconUsers, IconCheck } from '@/components/icons';
import styles from './page.module.css';

/**
 * Chat — admin tab pra governar features do universo de mensagens
 * (DMs, grupos, system events, integrações futuras).
 *
 * Estado atual: TODAS as funções aqui são MOCKADAS. Os toggles
 * são state local, sem persistência. Quando o backend de
 * "chat policies" for ligado, basta trocar `useState(initialFlags)`
 * por um `loadChatFeatures()`/`updateChatFeature()` mantendo o
 * shape dos dados — a UI desta página é agnóstica.
 *
 * Catálogo inicial foi desenhado pra cobrir os comportamentos
 * que o produto vai querer controlar primeiro:
 *   - reações, mentions, threads, links/embeds, anexos
 *   - controles de moderação (delete, mute, block)
 *   - integrações automáticas (welcome bot, notificações cruzadas)
 *
 * Cada feature carrega um id estável (slug) + label + descrição
 * curta, pra que telemetria e backend possam referenciar a feature
 * sem depender da copy renderizada.
 */

interface ChatFeature {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** Indica que a feature ainda não tem implementação real — só
   *  o toggle aqui. Render com `aria-disabled` pra deixar claro. */
  comingSoon?: boolean;
}

const FEATURES: ChatFeature[] = [
  {
    id: 'message_reactions',
    label: 'Reações em mensagens',
    description:
      'Permitir que usuários reajam às mensagens com emojis (👍 ❤️ 😂 etc.) em DMs e grupos.',
    defaultEnabled: true,
  },
  {
    id: 'mentions',
    label: 'Menções (@usuário)',
    description:
      'Habilitar autocomplete de @ em grupos. Membros mencionados recebem notificação dedicada.',
    defaultEnabled: true,
  },
  {
    id: 'replies',
    label: 'Responder mensagem',
    description:
      'Botão "Responder" no hover de cada mensagem, citando a original como contexto.',
    defaultEnabled: true,
  },
  {
    id: 'group_system_events',
    label: 'Badges de evento no grupo',
    description:
      'Mostrar "X criou o grupo", "Y entrou no grupo" como pílulas centralizadas no timeline.',
    defaultEnabled: true,
  },
  {
    id: 'group_rename',
    label: 'Renomear grupo',
    description: 'Owner pode editar o nome do grupo pelo painel de membros.',
    defaultEnabled: true,
  },
  {
    id: 'group_image_upload',
    label: 'Imagem do grupo',
    description:
      'Owner pode subir uma imagem customizada (jpg/png/webp/gif, máx. 2 MB).',
    defaultEnabled: true,
  },
  {
    id: 'message_delete',
    label: 'Apagar mensagem',
    description:
      'Autor pode apagar a própria mensagem; owner do grupo pode apagar qualquer uma. Mensagens apagadas ficam como pílula "Mensagem apagada" no timeline.',
    defaultEnabled: false,
    comingSoon: true,
  },
  {
    id: 'link_previews',
    label: 'Preview de links',
    description:
      'Renderizar miniatura + título + descrição quando um link colado tem Open Graph válido.',
    defaultEnabled: false,
    comingSoon: true,
  },
  {
    id: 'attachments',
    label: 'Anexos (imagens e arquivos)',
    description:
      'Anexar imagens, áudios ou documentos diretamente na mensagem. Hoje só texto é suportado.',
    defaultEnabled: false,
    comingSoon: true,
  },
  {
    id: 'voice_messages',
    label: 'Mensagens de voz',
    description:
      'Gravar e enviar mensagens de áudio curtas. Requer integração com nosso backend de mídia.',
    defaultEnabled: false,
    comingSoon: true,
  },
  {
    id: 'read_receipts',
    label: 'Confirmação de leitura',
    description:
      'Marcar quando o destinatário leu uma mensagem (✓ / ✓✓). Pode ser desativado por usuário também.',
    defaultEnabled: true,
  },
  {
    id: 'typing_indicators',
    label: 'Indicador de "digitando…"',
    description:
      'Mostrar quando o outro lado está digitando em DMs/grupos via socket.io.',
    defaultEnabled: true,
  },
  {
    id: 'new_dm_emails',
    label: 'E-mail "Nova DM"',
    description:
      'Disparar e-mail pra destinatários de DMs (independente de presença online). Snippet truncado em 200 chars.',
    defaultEnabled: true,
  },
  {
    id: 'block_users',
    label: 'Bloquear usuário',
    description:
      'Permitir que o usuário bloqueie outro — vocês não trocam mensagens nem aparecem nas listas um do outro.',
    defaultEnabled: false,
    comingSoon: true,
  },
  {
    id: 'report_message',
    label: 'Denunciar mensagem',
    description:
      'Kebab no hover pra denunciar uma mensagem — entra no fluxo de Moderação.',
    defaultEnabled: true,
  },
];

export default function ChatPage() {
  // State local — sem persistência. Trocar por loader/updater real
  // quando o backend de policies entrar.
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURES.map((f) => [f.id, f.defaultEnabled])),
  );

  const toggle = (id: string) => {
    setFlags((cur) => ({ ...cur, [id]: !cur[id] }));
  };

  const enabledCount = Object.values(flags).filter(Boolean).length;
  const comingSoonCount = FEATURES.filter((f) => f.comingSoon).length;

  return (
    <>
      <PageHeader
        title="Chat"
        description="Funções do universo de chat — DMs, grupos, reações, anexos, integrações. Cada toggle controla um comportamento específico da experiência de mensagens."
      />

      <div className={styles.body}>
        {/* ── KPIs ───────────────────────────────────────── */}
        <div className={styles.kpiGrid}>
          <StatCard
            label="Funções ativas"
            value={`${enabledCount} / ${FEATURES.length}`}
            icon={<IconCheck size={14} />}
            trendLabel="Recursos habilitados no produto"
          />
          <StatCard
            label="Em desenvolvimento"
            value={String(comingSoonCount)}
            icon={<IconHeart size={14} />}
            trendLabel="Roadmap próximo do Chat"
          />
          <StatCard
            label="Usuários cobertos"
            value="100%"
            icon={<IconUsers size={14} />}
            trendLabel="Toggles globais — sem segmentação por enquanto"
          />
        </div>

        {/* ── Lista de features ──────────────────────────── */}
        <Card className={styles.featuresCard}>
          <ul className={styles.list}>
            {FEATURES.map((f) => {
              const enabled = flags[f.id] ?? f.defaultEnabled;
              return (
                <li key={f.id} className={styles.row}>
                  <div className={styles.info}>
                    <div className={styles.titleRow}>
                      <span className={styles.label}>{f.label}</span>
                      {f.comingSoon && (
                        <span className={styles.comingSoon}>
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className={styles.description}>{f.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onChange={() => toggle(f.id)}
                    aria-label={`Ativar/desativar ${f.label}`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
