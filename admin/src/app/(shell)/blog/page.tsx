'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import { IconPlus } from '@/components/icons';
import PostsTab from '@/components/blog/PostsTab';
import CategoriasTab from '@/components/blog/CategoriasTab';
import AutoresTab from '@/components/blog/AutoresTab';
import styles from './page.module.css';

/**
 * Blog — página índice do módulo administrativo.
 *
 * Estrutura adotada (validada com produto):
 *   - /blog                    → essa página, com tabs Posts |
 *                                 Categorias | Autores
 *   - /blog/posts/novo         → editor full-page de criação
 *   - /blog/posts/[id]/editar  → editor full-page de edição
 *
 * Tabs porque categorias + autores são CRUDs leves (Dialog de
 * edição + tabela), e mantê-las na mesma rota economiza item no
 * sidebar e dá ao usuário a sensação de "tudo de blog num lugar
 * só". Posts vivem em routes próprios porque o editor é uma
 * experiência full-page (escrita longa precisa de espaço).
 *
 * O tab ativo persiste via `?tab=...` query string — deep links
 * pra Categorias / Autores funcionam direto do sidebar de outro
 * admin pra cá. Default é Posts.
 */

type BlogTab = 'posts' | 'categorias' | 'autores';

const TABS: { id: BlogTab; label: string }[] = [
  { id: 'posts',      label: 'Posts' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'autores',    label: 'Autores' },
];

function BlogIndexInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: BlogTab = (() => {
    const t = searchParams.get('tab');
    if (t === 'categorias' || t === 'autores' || t === 'posts') return t;
    return 'posts';
  })();
  const [tab, setTab] = useState<BlogTab>(initialTab);

  // Mantém o querystring sincronizado quando o usuário troca de
  // tab clicando — usa replaceState pra não poluir o histórico
  // de navegação com cada toggle.
  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    if (tab === 'posts') sp.delete('tab');
    else sp.set('tab', tab);
    const q = sp.toString();
    router.replace(q ? `/blog?${q}` : '/blog', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Blog"
        description="Posts, categorias e autores. Edição de post abre em página dedicada."
        actions={
          tab === 'posts' ? (
            // CTA Novo post alinhado ao header principal per
            // product feedback. Só aparece quando o tab Posts
            // está ativo — Categorias/Autores têm seus próprios
            // CTAs dentro dos seus Cards.
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={() => router.push('/blog/posts/novo')}
            >
              Novo post
            </Button>
          ) : null
        }
        tabs={
          <Tabs<BlogTab>
            variant="bordered"
            items={TABS}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === 'posts'      && <PostsTab />}
      {tab === 'categorias' && <CategoriasTab />}
      {tab === 'autores'    && <AutoresTab />}
    </div>
  );
}

/** Suspense boundary porque `useSearchParams` exige client-side
 *  render em alguns paths do build do Next 15 — sem o wrapper o
 *  prerender quebra. */
export default function BlogIndexPage() {
  return (
    <Suspense fallback={null}>
      <BlogIndexInner />
    </Suspense>
  );
}
