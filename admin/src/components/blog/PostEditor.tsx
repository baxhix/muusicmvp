'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import {
  IconCheck,
  IconChevronLeft,
  IconCalendar,
  IconEdit,
} from '@/components/icons';
import RichTextEditor from './RichTextEditor';
import PostStatusBadge from './PostStatusBadge';
import BlogImageUploader from './BlogImageUploader';
import { slugify } from '@/lib/blog/slug';
import { blogPostsService } from '@/services/blog/posts';
import { blogCategoriesService } from '@/services/blog/categories';
import { blogAuthorsService } from '@/services/blog/authors';
import { blogTagsService } from '@/services/blog/tags';
import { formatRelative } from '@/lib/format';
import type {
  BlogAuthor,
  BlogCategory,
  BlogPost,
  BlogPostStatus,
  BlogTag,
} from '@/types/blog';
import styles from './PostEditor.module.css';

/**
 * PostEditor — formulário completo de criação/edição de post.
 *
 * Layout em duas colunas no desktop, colapsando pra single
 * column em mobile:
 *   - Coluna principal (60%): título, subtítulo, slug, cover,
 *     resumo e EDITOR RICO (parte mais larga + alta da página).
 *   - Coluna lateral (40%): status, categoria, autor, tags,
 *     agendamento, SEO/GEO (accordion).
 *
 * Por que página dedicada (não drawer): edição de conteúdo
 * longo precisa de espaço — drawers tipicamente têm 420-480px e
 * sufocam a redação. Aqui usamos o conteúdo full-width do shell
 * admin.
 *
 * Composição:
 *   - /blog/posts/novo            usa <PostEditor mode="create" />
 *   - /blog/posts/[id]/editar     usa <PostEditor mode="edit"
 *                                                 initialPost={...} />
 */

export interface PostEditorProps {
  mode: 'create' | 'edit';
  /** Quando mode='edit', injeta o post atual pra hidratar o
   *  form. Quando mode='create', undefined. */
  initialPost?: BlogPost;
}

interface FormState {
  title: string;
  subtitle: string;
  slug: string;
  slugAuto: boolean;
  coverImageUrl: string;
  coverImageAlt: string;
  excerpt: string;
  bodyHtml: string;
  authorId: string;
  categoryId: string;
  tagIds: string[];
  status: BlogPostStatus;
  /** ISO string ou '' enquanto não agendado. UI usa input
   *  `datetime-local`. */
  publishedAt: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  focusKeywordsCsv: string;
  ogImageUrl: string;
}

function emptyState(): FormState {
  return {
    title: '',
    subtitle: '',
    slug: '',
    slugAuto: true,
    coverImageUrl: '',
    coverImageAlt: '',
    excerpt: '',
    bodyHtml: '',
    authorId: '',
    categoryId: '',
    tagIds: [],
    status: 'draft',
    publishedAt: '',
    metaTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    focusKeywordsCsv: '',
    ogImageUrl: '',
  };
}

function stateFromPost(p: BlogPost): FormState {
  return {
    title: p.title,
    subtitle: p.subtitle ?? '',
    slug: p.slug,
    slugAuto: false,
    coverImageUrl: p.coverImageUrl ?? '',
    coverImageAlt: p.coverImageAlt ?? '',
    excerpt: p.excerpt ?? '',
    bodyHtml: p.bodyHtml,
    authorId: p.authorId,
    categoryId: p.categoryId,
    tagIds: p.tags.map((t) => t.id),
    status: p.status,
    publishedAt: p.publishedAt ?? '',
    metaTitle: p.seo.metaTitle ?? '',
    metaDescription: p.seo.metaDescription ?? '',
    canonicalUrl: p.seo.canonicalUrl ?? '',
    focusKeywordsCsv: (p.seo.focusKeywords ?? []).join(', '),
    ogImageUrl: p.seo.ogImageUrl ?? '',
  };
}

export default function PostEditor({ mode, initialPost }: PostEditorProps) {
  const router = useRouter();
  const { push } = useToast();

  const [form, setForm] = useState<FormState>(() =>
    initialPost ? stateFromPost(initialPost) : emptyState(),
  );
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [tagsCatalog, setTagsCatalog] = useState<BlogTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(
    form.status === 'scheduled',
  );

  const load = useCallback(async () => {
    const [c, a, t] = await Promise.all([
      blogCategoriesService.list({ status: 'active', limit: 200 }),
      blogAuthorsService.list({ limit: 200 }),
      blogTagsService.list(),
    ]);
    setCategories(c.items);
    setAuthors(a.items);
    setTagsCatalog(t);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Updaters granulares — evitam um único onChange gigante. */
  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateTitle = useCallback(
    (title: string) => {
      setForm((prev) => ({
        ...prev,
        title,
        slug: prev.slugAuto ? slugify(title) : prev.slug,
      }));
    },
    [],
  );

  const updateSlug = useCallback((slug: string) => {
    setForm((prev) => ({ ...prev, slug: slugify(slug), slugAuto: false }));
  }, []);

  // Toggle de tag no array. Mantém ordem alfabética estável. */
  const toggleTag = useCallback((tagId: string) => {
    setForm((prev) => {
      const has = prev.tagIds.includes(tagId);
      return {
        ...prev,
        tagIds: has
          ? prev.tagIds.filter((id) => id !== tagId)
          : [...prev.tagIds, tagId],
      };
    });
  }, []);

  const valid = useMemo(() => {
    return (
      form.title.trim().length >= 3 &&
      form.slug.trim().length >= 3 &&
      form.authorId.length > 0 &&
      form.categoryId.length > 0
    );
  }, [form]);

  const focusKeywords = useMemo(
    () =>
      form.focusKeywordsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [form.focusKeywordsCsv],
  );

  async function handleSave(targetStatus?: BlogPostStatus) {
    if (!valid) return;
    setSaving(true);
    try {
      const nextStatus = targetStatus ?? form.status;
      const publishedAt =
        nextStatus === 'published'
          ? form.publishedAt || new Date().toISOString()
          : nextStatus === 'scheduled'
            ? form.publishedAt || null
            : nextStatus === 'archived'
              ? form.publishedAt || null
              : null;

      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        slug: form.slug,
        coverImageUrl: form.coverImageUrl || null,
        coverImageAlt: form.coverImageAlt,
        excerpt: form.excerpt,
        bodyHtml: form.bodyHtml,
        authorId: form.authorId,
        categoryId: form.categoryId,
        tagIds: form.tagIds,
        status: nextStatus,
        publishedAt,
        seo: {
          metaTitle: form.metaTitle || undefined,
          metaDescription: form.metaDescription || undefined,
          canonicalUrl: form.canonicalUrl || undefined,
          focusKeywords: focusKeywords.length > 0 ? focusKeywords : undefined,
          ogImageUrl: form.ogImageUrl || undefined,
        },
      };

      if (mode === 'create') {
        const created = await blogPostsService.create(payload);
        push({
          type: 'success',
          title:
            nextStatus === 'published'
              ? 'Post publicado'
              : nextStatus === 'scheduled'
                ? 'Post agendado'
                : 'Rascunho salvo',
          description: `"${created.title}" salvo.`,
        });
        router.push(`/blog/posts/${created.id}/editar`);
      } else if (initialPost) {
        const updated = await blogPostsService.update({
          id: initialPost.id,
          ...payload,
        });
        push({
          type: 'success',
          title: 'Post atualizado',
          description: `"${updated.title}" salvo.`,
        });
        // Atualiza o form com os campos denormalizados que o
        // server reescreveu (status, publishedAt etc.).
        setForm(stateFromPost(updated));
      }
    } catch (err) {
      console.error('post save failed:', err);
      push({
        type: 'error',
        title: 'Erro ao salvar',
        description: 'Verifique os campos obrigatórios e tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }

  const pageTitle =
    mode === 'create' ? 'Novo post' : (initialPost?.title ?? 'Editar post');

  return (
    <div className={styles.page}>
      <PageHeader
        title={pageTitle}
        description={
          mode === 'edit' && initialPost
            ? `Atualizado ${formatRelative(initialPost.updatedAt)} · ${
                initialPost.revisionCount
              } revisão(ões)`
            : 'Criação de post — todos os campos abaixo, inclusive SEO/GEO, ficam disponíveis aqui.'
        }
        actions={
          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<IconChevronLeft size={14} />}
              onClick={() => router.push('/blog')}
            >
              Voltar
            </Button>
            {mode === 'edit' && initialPost && (
              <PostStatusBadge status={initialPost.status} />
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={!valid || saving}
              loading={saving}
              onClick={() => void handleSave('draft')}
            >
              Salvar rascunho
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!valid || saving}
              loading={saving}
              leadingIcon={!saving ? <IconCheck size={14} /> : undefined}
              onClick={() => void handleSave('published')}
            >
              Publicar
            </Button>
          </div>
        }
      />

      <div className={styles.layout}>
        {/* ── Coluna principal ────────────────────────────── */}
        <div className={styles.colMain}>
          <Card>
            <div className={styles.formBody}>
              <Input
                label="Título"
                required
                value={form.title}
                placeholder="Ex.: A boiadeira no Reino Unido — bastidores do show"
                onChange={(e) => updateTitle(e.target.value)}
              />
              <Input
                label="Subtítulo"
                value={form.subtitle}
                placeholder="Linha de apoio que sai abaixo do título no blog público (opcional)."
                onChange={(e) => update('subtitle', e.target.value)}
              />
              <Input
                label="Slug"
                required
                value={form.slug}
                placeholder="boiadeira-no-reino-unido"
                helperText={`URL pública: /blog/${form.slug || '...'}`}
                onChange={(e) => updateSlug(e.target.value)}
              />
              <div className={styles.coverField}>
                <label className={styles.fieldLabel}>Imagem destaque</label>
                <BlogImageUploader
                  value={form.coverImageUrl}
                  onChange={(url) => update('coverImageUrl', url)}
                  hint="Aparece como cover do post + og:image padrão. Recomendado 1200×630."
                  aspectRatio="16/9"
                />
                <Input
                  label="Alt da imagem destaque"
                  value={form.coverImageAlt}
                  placeholder="Descrição da imagem (acessibilidade + SEO)."
                  onChange={(e) => update('coverImageAlt', e.target.value)}
                />
              </div>
              <Textarea
                label="Resumo / excerpt"
                rows={3}
                value={form.excerpt}
                placeholder="1-2 parágrafos. Aparece em listagens e como fallback de meta description."
                onChange={(e) => update('excerpt', e.target.value)}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Conteúdo"
              description="Editor rico — gera HTML semântico. Use H2-H4 pra estruturar; H1 já é o título do post."
            />
            <div className={styles.editorWrap}>
              <RichTextEditor
                value={form.bodyHtml}
                onChange={(html) => update('bodyHtml', html)}
                placeholder="Comece escrevendo aqui…"
              />
            </div>
          </Card>
        </div>

        {/* ── Coluna lateral ──────────────────────────────── */}
        <aside className={styles.colSide}>
          <Card>
            <CardHeader title="Publicação" />
            <div className={styles.sideBody}>
              <Select
                label="Status"
                required
                value={form.status}
                onChange={(e) => {
                  const next = e.target.value as BlogPostStatus;
                  update('status', next);
                  setScheduleOpen(next === 'scheduled');
                }}
                options={[
                  { value: 'draft',     label: 'Rascunho' },
                  { value: 'scheduled', label: 'Agendado' },
                  { value: 'published', label: 'Publicado' },
                  { value: 'archived',  label: 'Arquivado' },
                ]}
              />
              {(scheduleOpen || form.status === 'scheduled') && (
                <Input
                  label="Data e hora de publicação"
                  type="datetime-local"
                  value={form.publishedAt ? toLocalDatetime(form.publishedAt) : ''}
                  onChange={(e) =>
                    update(
                      'publishedAt',
                      e.target.value ? new Date(e.target.value).toISOString() : '',
                    )
                  }
                  leadingIcon={<IconCalendar size={14} />}
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Classificação" />
            <div className={styles.sideBody}>
              <Select
                label="Categoria"
                required
                value={form.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
                options={[
                  { value: '', label: 'Escolha uma categoria…' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <Select
                label="Autor"
                required
                value={form.authorId}
                onChange={(e) => update('authorId', e.target.value)}
                options={[
                  { value: '', label: 'Escolha um autor…' },
                  ...authors.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
              {form.authorId && (
                <AuthorPreview
                  authorId={form.authorId}
                  authors={authors}
                />
              )}
              <div className={styles.tagsField}>
                <span className={styles.tagsLabel}>Tags</span>
                <div className={styles.tagsList}>
                  {tagsCatalog.map((t) => {
                    const active = form.tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`${styles.tagChip} ${active ? styles.tagChipActive : ''}`}
                        onClick={() => toggleTag(t.id)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <span className={styles.tagsHint}>
                  Clique pra adicionar/remover. Tags novas serão criadas via
                  o editor expandido futuramente.
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="SEO / GEO"
              description="Otimização pra crawlers tradicionais e LLMs."
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeoOpen((v) => !v)}
                  leadingIcon={<IconEdit size={14} />}
                >
                  {seoOpen ? 'Recolher' : 'Expandir'}
                </Button>
              }
            />
            {seoOpen && (
              <div className={styles.sideBody}>
                <Input
                  label="Meta title"
                  value={form.metaTitle}
                  placeholder={form.title || 'Padrão: usa o título do post'}
                  helperText="Recomendado até 60 caracteres."
                  onChange={(e) => update('metaTitle', e.target.value)}
                />
                <Textarea
                  label="Meta description"
                  rows={3}
                  value={form.metaDescription}
                  placeholder={
                    form.excerpt || 'Padrão: usa o resumo do post.'
                  }
                  helperText="Recomendado até 160 caracteres."
                  onChange={(e) => update('metaDescription', e.target.value)}
                />
                <Input
                  label="URL canônica"
                  value={form.canonicalUrl}
                  placeholder="Padrão: aponta pra própria URL do post"
                  onChange={(e) => update('canonicalUrl', e.target.value)}
                />
                <Input
                  label="Focus keywords"
                  value={form.focusKeywordsCsv}
                  placeholder="ana castela, boiadeira, sertanejo"
                  helperText="Separe por vírgula. Alimenta meta keywords + schema.org."
                  onChange={(e) =>
                    update('focusKeywordsCsv', e.target.value)
                  }
                />
                <div className={styles.coverField}>
                  <label className={styles.fieldLabel}>
                    og:image (override)
                  </label>
                  <BlogImageUploader
                    value={form.ogImageUrl}
                    onChange={(url) => update('ogImageUrl', url)}
                    hint="Opcional · sobrescreve a imagem destaque pra cards de compartilhamento."
                    aspectRatio="16/9"
                  />
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AuthorPreview({
  authorId,
  authors,
}: {
  authorId: string;
  authors: BlogAuthor[];
}) {
  const a = authors.find((u) => u.id === authorId);
  if (!a) return null;
  return (
    <div className={styles.authorPreview}>
      <Avatar name={a.name} src={a.avatarUrl ?? undefined} size="md" />
      <div className={styles.authorPreviewBody}>
        <span className={styles.authorPreviewName}>{a.name}</span>
        <span className={styles.authorPreviewBio}>
          {a.bio ?? a.email}
        </span>
      </div>
    </div>
  );
}

/** Converte ISO em formato aceito pelo input datetime-local
 *  (YYYY-MM-DDTHH:MM, sem timezone). Browser interpreta como
 *  timezone local; no save reconvertemos pra ISO. */
function toLocalDatetime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
