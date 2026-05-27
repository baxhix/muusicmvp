'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Table, { type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { IconChevronLeft, IconLink, IconUsers } from '@/components/icons';
import {
  acquisitionService,
  buildShareableUrl,
  type AdminArtistLink,
  type LinkUserRow,
} from '@/services/acquisition';
import styles from './page.module.css';

/**
 * Detalhe de um artist signup link — mostra os dados do link
 * + tabela paginada de users que se cadastraram através dele.
 *
 * Click numa linha de user navega pra /users/[id] (admin user
 * detail). Botão "Copiar link" + back arrow no header.
 */
export default function ArtistLinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { push } = useToast();
  const [link, setLink] = useState<AdminArtistLink | null>(null);
  const [users, setUsers] = useState<LinkUserRow[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    /* Carrega link e users em paralelo. */
    Promise.all([
      acquisitionService.detail(id),
      acquisitionService.users(id, { limit: 200 }),
    ])
      .then(([linkRes, usersRes]) => {
        if (cancelled) return;
        setLink(linkRes.link);
        setUsers(usersRes.items);
        setTotal(usersRes.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        push({
          type: 'error',
          title: 'Erro ao carregar',
          description: err instanceof Error ? err.message : '',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, push]);

  async function copyLink() {
    if (!link) return;
    const url = buildShareableUrl(link.slug);
    try {
      await navigator.clipboard.writeText(url);
      push({
        type: 'success',
        title: 'Link copiado',
        description: url,
      });
    } catch {
      push({
        type: 'error',
        title: 'Não foi possível copiar',
        description: 'Selecione manualmente.',
      });
    }
  }

  const columns: Column<LinkUserRow>[] = [
    {
      id: 'user',
      header: 'Usuário',
      cell: (u) => (
        <div className={styles.userRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.avatarUrl ?? '/avatar-placeholder.svg'}
            alt=""
            className={styles.userAvatar}
            onError={(e) => {
              const fb = '/avatar-placeholder.svg';
              if (!e.currentTarget.src.endsWith(fb)) {
                e.currentTarget.src = fb;
              }
            }}
          />
          <div className={styles.userMeta}>
            <span className={styles.userName}>
              {u.name ?? u.email.split('@')[0]}
            </span>
            <span className={styles.userEmail}>{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'onboarded',
      header: 'Status',
      sortKey: (u) => (u.isOnboarded ? 0 : 1),
      cell: (u) =>
        u.isOnboarded ? (
          <Badge tone="success" size="sm" dot>
            Onboarding completo
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            Onboarding pendente
          </Badge>
        ),
      width: 200,
    },
    {
      id: 'createdAt',
      header: 'Cadastrou em',
      sortKey: (u) => u.createdAt,
      cell: (u) =>
        new Date(u.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      width: 140,
    },
  ];

  return (
    <>
      <PageHeader
        title={link ? link.artistName : 'Carregando…'}
        description={
          link
            ? `Signups atribuídos a este link de aquisição (${total} total).`
            : ''
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<IconChevronLeft size={14} />}
              onClick={() => router.push('/aquisicao')}
            >
              Voltar
            </Button>
            {link && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<IconLink size={14} />}
                onClick={copyLink}
              >
                Copiar link
              </Button>
            )}
          </>
        }
      />

      <div className={styles.body}>
        {link && (
          <Card>
            <div className={styles.linkInfo}>
              <div>
                <span className={styles.infoLabel}>Slug</span>
                <code className={styles.infoSlug}>/r/{link.slug}</code>
              </div>
              {link.label && (
                <div>
                  <span className={styles.infoLabel}>Rótulo interno</span>
                  <span className={styles.infoValue}>{link.label}</span>
                </div>
              )}
              <div>
                <span className={styles.infoLabel}>Criado em</span>
                <span className={styles.infoValue}>
                  {new Date(link.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div>
                <span className={styles.infoLabel}>Status</span>
                {link.archivedAt ? (
                  <Badge tone="neutral" size="sm">
                    Arquivado
                  </Badge>
                ) : (
                  <Badge tone="success" size="sm" dot>
                    Ativo
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            title={`Usuários (${total})`}
            description="Cada signup que veio pelo link e completou (ou está completando) o cadastro."
          />
          <Table<LinkUserRow>
            columns={columns}
            data={users ?? []}
            rowId={(u) => u.id}
            onRowClick={(u) => router.push(`/users/${u.id}`)}
            pageSize={20}
            loading={users === null}
            emptyState={
              <div className={styles.emptyState}>
                <IconUsers size={20} />
                <span>Ainda nenhum signup atribuído a este link.</span>
              </div>
            }
          />
        </Card>
      </div>
    </>
  );
}
