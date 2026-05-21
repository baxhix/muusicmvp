'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PostEditor from '@/components/blog/PostEditor';
import { blogPostsService } from '@/services/blog/posts';
import type { BlogPost } from '@/types/blog';

/**
 * Página dedicada de edição de post.
 *
 * Carrega o post pelo id da URL antes de hidratar o editor. Em
 * caso de "not found" (post deletado de outra aba), redireciona
 * pro index do blog. Loading state simples — placeholder até o
 * fetch resolver.
 */
export default function EditarPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await blogPostsService.get(id);
      if (cancelled) return;
      if (!found) {
        router.replace('/blog');
        return;
      }
      setPost(found);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading || !post) {
    // Loading minimalista — segue o padrão usado nas demais
    // páginas do admin (sem skeleton custom; o PageHeader vazio
    // já dá densidade visual o suficiente).
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--text-mute)' }}>
        Carregando post…
      </div>
    );
  }

  return <PostEditor mode="edit" initialPost={post} />;
}
