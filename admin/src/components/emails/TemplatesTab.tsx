'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconMail, IconSearch } from '@/components/icons';
import {
  emailsService,
  AUDIENCE_LABEL,
  type EmailTemplate,
  type TemplateAudience,
} from '@/services/emails';
import { cn } from '@/lib/utils';
import CreateTemplateDialog from './CreateTemplateDialog';
import styles from './TemplatesTab.module.css';

/**
 * Lista de templates de email.
 *
 * UX:
 *   - Toolbar com busca (label/kind/descrição) + chips de audience
 *     (Todos / Gestão / Usuários). Pensado pra escalar: hoje 6
 *     templates, em breve dezenas.
 *   - Card "+ Criar template" sempre no fim do grid.
 *   - Cards dos templates com badges de status + thumbnail mini do
 *     preview gerado a partir do design (ou fallback se HTML).
 *   - Click no card abre rota dedicada `/emails/templates/[kind]/edit`.
 *
 * Editar continua a experiência cheia: top bar, sidebar, preview
 * com device frame. Sem modais cortando.
 */

type AudienceFilter = '' | TemplateAudience;

const AUDIENCE_FILTERS: { value: AudienceFilter; label: string }[] = [
  { value: '',         label: 'Todos' },
  { value: 'gestao',   label: AUDIENCE_LABEL.gestao },
  { value: 'usuarios', label: AUDIENCE_LABEL.usuarios },
];

export default function TemplatesTab() {
  const router = useRouter();
  const [items, setItems] = useState<EmailTemplate[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState<AudienceFilter>('');
  const { push } = useToast();

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refetch() {
    emailsService.templates
      .list()
      .then((res) => setItems(res.items))
      .catch((err: unknown) => {
        push({
          type: 'error',
          title: 'Erro ao carregar templates',
          description: err instanceof Error ? err.message : 'Tente novamente.',
        });
        setItems([]);
      });
  }

  function openEdit(kind: string) {
    router.push(`/emails/templates/${kind}/edit`);
  }

  /* Defer pro filter não recalcular a cada keystroke. Mantém UI
   * responsiva mesmo quando a lista crescer. */
  const deferredSearch = useDeferredValue(search);
  const deferredAudience = useDeferredValue(audience);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = deferredSearch.trim().toLowerCase();
    return items.filter((t) => {
      if (deferredAudience && t.audience !== deferredAudience) return false;
      if (!q) return true;
      const hay = `${t.label} ${t.kind} ${t.description}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, deferredSearch, deferredAudience]);

  /* Contadores por audience pra mostrar nas chips — feedback de
   * quantos templates caem em cada categoria sem precisar trocar
   * o filtro pra descobrir. */
  const counts = useMemo(() => {
    if (!items) return { '': 0, gestao: 0, usuarios: 0 };
    return items.reduce(
      (acc, t) => {
        acc[''] += 1;
        acc[t.audience] += 1;
        return acc;
      },
      { '': 0, gestao: 0, usuarios: 0 } as Record<AudienceFilter, number>,
    );
  }, [items]);

  const showingFiltered =
    items != null && (deferredSearch.trim() !== '' || deferredAudience !== '');

  return (
    <>
      <Card>
        <CardHeader
          title="Templates do sistema"
          description="Cada tipo de email disparado pela plataforma. Edite cores, blocos e textos visualmente; ou caia no HTML cru se precisar de controle total. Desativar um template editado faz o sistema usar o fallback hardcoded — kill switch seguro."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={() => setCreating(true)}
            >
              Novo template
            </Button>
          }
        />

        {/* ── Toolbar: busca + filtros de audience ───────────── */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Input
              inputSize="md"
              placeholder="Buscar por nome, kind ou descrição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<IconSearch size={14} />}
            />
          </div>
          <div
            className={styles.chips}
            role="tablist"
            aria-label="Filtrar por destinatário"
          >
            {AUDIENCE_FILTERS.map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                role="tab"
                aria-selected={audience === opt.value}
                className={cn(
                  styles.chip,
                  audience === opt.value && styles.chipActive,
                )}
                onClick={() => setAudience(opt.value)}
              >
                <span>{opt.label}</span>
                <span className={styles.chipCount}>{counts[opt.value]}</span>
              </button>
            ))}
          </div>
        </div>

        {showingFiltered && (
          <div className={styles.filterSummary}>
            <span>
              {filtered.length} de {items?.length ?? 0} templates
            </span>
            {(search || audience) && (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={() => {
                  setSearch('');
                  setAudience('');
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        <div className={styles.grid}>
          {items === null && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {filtered.map((t) => (
            <TemplateCard
              key={t.kind}
              template={t}
              onOpen={() => openEdit(t.kind)}
            />
          ))}

          {/* Empty state — só quando há filtro ativo. Sem filtro,
           * o card "Criar template" garante que o grid nunca fica
           * vazio visualmente. */}
          {items !== null && filtered.length === 0 && showingFiltered && (
            <div className={styles.emptyState}>
              <IconMail size={24} />
              <p>Nenhum template corresponde aos filtros.</p>
              <button
                type="button"
                className={styles.clearFilters}
                onClick={() => {
                  setSearch('');
                  setAudience('');
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}

          {items && (
            <button
              type="button"
              className={styles.createCard}
              onClick={() => setCreating(true)}
            >
              <div className={styles.createIcon}>
                <IconPlus size={20} />
              </div>
              <div className={styles.createTitle}>Criar template</div>
              <div className={styles.createHint}>
                Boas-vindas, recuperação, anúncios e mais.
              </div>
            </button>
          )}
        </div>
      </Card>

      <CreateTemplateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={refetch}
      />
    </>
  );
}

/* ── Template card ───────────────────────────────────────────── */

interface TemplateCardProps {
  template: EmailTemplate;
  onOpen: () => void;
}

function TemplateCard({ template, onOpen }: TemplateCardProps) {
  const isKnown = template.defaultDesign !== null;
  /* Cor de fundo do thumbnail = bgColor do tema (ou um neutro
   * se template não tem design). Cria diferenciação visual entre
   * templates rapidamente. */
  const accentBg = template.design?.theme.bgColor ?? '#f6f6f7';
  const buttonBg = template.design?.theme.buttonBg ?? '#1a1a1a';

  return (
    <article
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={styles.thumb} style={{ background: accentBg }}>
        <div className={styles.thumbInner}>
          <div className={styles.thumbBar} />
          <div className={styles.thumbBar} style={{ width: '60%' }} />
          <div
            className={styles.thumbButton}
            style={{ background: buttonBg }}
          />
          <div className={styles.thumbBar} style={{ width: '80%' }} />
        </div>
        <div className={styles.thumbIcon}>
          <IconMail size={18} />
        </div>
      </div>

      <div className={styles.cardBody}>
        {/* Header agora empilhado: título ocupa a linha INTEIRA (sem
         * dividir espaço com o kind), e o kind aparece embaixo em
         * fonte monoespaçada menor. Faz title acomodar nomes longos
         * sem truncar feio em "Bem-vindos ao…". */}
        <header className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{template.label}</h3>
          <code className={styles.cardKind}>{template.kind}</code>
        </header>

        <p className={styles.cardDescription}>{template.description}</p>

        <div className={styles.cardFooter}>
          <div className={styles.cardBadges}>
            {/* Audience SEMPRE primeiro — é a classificação mais
             * acionável visualmente (gestão vs usuários). */}
            <Badge
              tone={template.audience === 'gestao' ? 'info' : 'neutral'}
              size="sm"
            >
              {AUDIENCE_LABEL[template.audience]}
            </Badge>
            {template.isEdited && template.isActive && (
              <Badge tone="brand" size="sm" dot>Ativo</Badge>
            )}
            {template.isEdited && !template.isActive && (
              <Badge tone="neutral" size="sm">Desativado</Badge>
            )}
            {!template.isEdited && (
              <Badge tone="neutral" size="sm">Default</Badge>
            )}
            {!isKnown && (
              <Badge tone="warning" size="sm">Custom</Badge>
            )}
            {template.design && (
              <Badge tone="success" size="sm">Visual</Badge>
            )}
          </div>
          <span className={styles.cardEdit}>
            <IconEdit size={12} /> Editar
          </span>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className={`${styles.card} ${styles.skeleton}`}>
      <div className={styles.thumb} />
      <div className={styles.cardBody}>
        <div className={styles.skeletonLine} style={{ width: '60%' }} />
        <div className={styles.skeletonLine} style={{ width: '40%' }} />
        <div className={styles.skeletonLine} style={{ width: '90%' }} />
      </div>
    </div>
  );
}
