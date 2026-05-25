'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconMail } from '@/components/icons';
import { emailsService, type EmailTemplate } from '@/services/emails';
import CreateTemplateDialog from './CreateTemplateDialog';
import styles from './TemplatesTab.module.css';

/**
 * Lista de templates de email.
 *
 * UX:
 *   - Card "+ Criar template" sempre no início, dashed border pra
 *     parecer um slot vazio.
 *   - Cards dos templates com badges de status + thumbnail mini
 *     do preview gerado a partir do design (ou fallback se HTML).
 *   - Click no card abre rota dedicada `/emails/templates/[kind]/edit`.
 *
 * Editar continua a experiência cheia: top bar, sidebar, preview
 * com device frame. Sem modais cortando.
 */
export default function TemplatesTab() {
  const router = useRouter();
  const [items, setItems] = useState<EmailTemplate[] | null>(null);
  const [creating, setCreating] = useState(false);
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

        <div className={styles.grid}>
          {items === null && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {items?.map((t) => (
            <TemplateCard
              key={t.kind}
              template={t}
              onOpen={() => openEdit(t.kind)}
            />
          ))}

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
        <header className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{template.label}</h3>
          <code className={styles.cardKind}>{template.kind}</code>
        </header>

        <p className={styles.cardDescription}>{template.description}</p>

        <div className={styles.cardFooter}>
          <div className={styles.cardBadges}>
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
