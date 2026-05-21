'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { IconImage, IconLink, IconVideo } from '@/components/icons';
import BlogImageUploader from './BlogImageUploader';
import styles from './RichTextEditor.module.css';

/**
 * RichTextEditor — editor visual (WYSIWYG) baseado em
 * `contentEditable` que produz HTML semântico (h2/h3/h4, p, ul,
 * ol, blockquote, code, hr, a, img, figure>iframe pra vídeo).
 *
 * Decisões de arquitetura:
 *   1. Sem dependência externa (tiptap, slate, lexical). Mantém
 *      o bundle do admin enxuto pro MVP. Se o blog crescer a
 *      ponto de precisar de features avançadas (colab tempo
 *      real, tabelas, mentions), troca-se este componente por
 *      tiptap sem mudar a API pública (props `value` e
 *      `onChange`). Toda a complexidade encapsulada aqui.
 *
 *   2. Headings começam em H2 — o H1 é gerenciado pela rota
 *      pública do blog (template renderiza <h1>{post.title}</h1>).
 *      O usuário não pode subir a hierarquia além de H4 pra
 *      preservar estrutura semântica que LLMs e crawlers
 *      precisam pra ranquear.
 *
 *   3. Output é a propriedade `innerHTML` do contentEditable
 *      "tal qual". Sanitização real (remoção de <script>, attrs
 *      perigosos) DEVE acontecer server-side antes de gravar —
 *      o cliente é considerado untrusted. Não fazemos sanitize
 *      aqui pra não duplicar trabalho.
 *
 *   4. Os comandos usam `document.execCommand` — API legacy mas
 *      ainda funcional em todos os browsers modernos pra ações
 *      básicas (bold/italic/headings/lists). Sub-comandos
 *      customizados (insert image, link, hr) usam a Selection
 *      API direto.
 */

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Quando true, mostra a área de Preview lado a lado. Botão
   *  no toolbar alterna. */
  defaultPreview?: boolean;
}

type Block = 'p' | 'h2' | 'h3' | 'h4';

const BLOCK_LABELS: Record<Block, string> = {
  p: 'Parágrafo',
  h2: 'H2',
  h3: 'H3',
  h4: 'H4',
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Comece a escrever…',
  defaultPreview = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [preview, setPreview] = useState(defaultPreview);
  // Re-render trigger pra atualizar o estado ativo dos botões
  // do toolbar (bold/italic, current block) sem precisar de
  // observers pesados.
  const [, forceRerender] = useState({});
  const refreshToolbar = useCallback(() => forceRerender({}), []);

  // Estado do dialog de inserir imagem (URL upload + alt).
  // Quando aberto, preservamos a Range atual do editor pra
  // restaurar o cursor antes do insertHTML — abrir o dialog
  // muda o foco e perderia a posição.
  const [imageDialog, setImageDialog] = useState<{
    open: boolean;
    url: string;
    alt: string;
  }>({ open: false, url: '', alt: '' });

  // Sincroniza o `value` externo com o conteúdo do contentEditable
  // SEM perder a posição do cursor. Só sobrescreve quando a
  // diferença sair do controle (ex.: form reset). */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML === value) return;
    // Em caso de divergência por update externo, perde-se a
    // posição do cursor — comportamento aceitável pra um setter
    // imperativo. Edição contínua do usuário não passa por aqui.
    el.innerHTML = value || '';
  }, [value]);

  function handleInput() {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
  }

  function exec(command: string, val?: string) {
    // Restaura o foco no editor antes do command — se o usuário
    // clicou num botão da toolbar, o foco está no botão e o
    // execCommand falharia.
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    refreshToolbar();
    handleInput();
  }

  function setBlock(block: Block) {
    // formatBlock pede o tag entre <>. P/H2/H3/H4 funcionam em
    // todos os browsers que aceitam contentEditable. */
    exec('formatBlock', `<${block}>`);
  }

  function insertLink() {
    const url = window.prompt(
      'URL do link (com https://):',
      'https://',
    );
    if (!url) return;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      window.alert('Use uma URL completa começando com http:// ou https://');
      return;
    }
    exec('createLink', trimmed);
    // Aplica target="_blank" + rel="noopener" no link recém
    // criado pra não levar o leitor pra fora do site sem
    // proteção CSRF. */
    const sel = window.getSelection();
    const anchor = sel?.anchorNode?.parentElement?.closest('a');
    if (anchor) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
    handleInput();
  }

  /** Abre o dialog de inserir imagem. Salva a Range atual pra
   *  poder restaurar o cursor depois — clicar no botão muda o
   *  foco pra fora do contentEditable. */
  function openImageDialog() {
    const sel = window.getSelection();
    savedRangeRef.current =
      sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setImageDialog({ open: true, url: '', alt: '' });
  }

  function confirmImageDialog() {
    const { url, alt } = imageDialog;
    if (!url) return;
    // Restaura a posição original do cursor antes de inserir.
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    // Envolvemos em <figure> pra que o blog público possa
    // estilizar captions futuras + crawlers entendam o bloco. */
    const figureHtml = `<figure><img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" /></figure>`;
    document.execCommand('insertHTML', false, figureHtml);
    setImageDialog({ open: false, url: '', alt: '' });
    savedRangeRef.current = null;
    refreshToolbar();
    handleInput();
  }

  function insertVideo() {
    const url = window.prompt(
      'URL do vídeo (YouTube, Vimeo, ou link direto MP4):',
      'https://',
    );
    if (!url) return;
    const trimmed = url.trim();
    const embedSrc = toEmbedSrc(trimmed);
    if (!embedSrc) {
      window.alert(
        'Não consegui reconhecer essa URL. Use um link de YouTube/Vimeo válido ou um arquivo .mp4 direto.',
      );
      return;
    }
    const html =
      embedSrc.type === 'iframe'
        ? `<figure class="video-embed"><iframe src="${escapeAttr(embedSrc.url)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>`
        : `<figure class="video-embed"><video src="${escapeAttr(embedSrc.url)}" controls></video></figure>`;
    exec('insertHTML', html);
  }

  function insertHr() {
    exec('insertHTML', '<hr />');
  }

  // Detecta o bloco atual (p/h2/h3/h4) pra destacar o botão
  // ativo no toolbar. Roda em cada render via refreshToolbar. */
  function currentBlock(): Block {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 'p';
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1) {
        const tag = (node as HTMLElement).tagName.toLowerCase();
        if (tag === 'h2' || tag === 'h3' || tag === 'h4') return tag as Block;
        if (tag === 'p') return 'p';
      }
      node = node.parentNode;
    }
    return 'p';
  }

  function isActive(command: string): boolean {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }

  const block = currentBlock();

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatação">
        <div className={styles.group}>
          {(['p', 'h2', 'h3', 'h4'] as const).map((b) => (
            <button
              key={b}
              type="button"
              className={`${styles.btn} ${styles.btnText} ${block === b ? styles.btnActive : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBlock(b)}
              aria-label={BLOCK_LABELS[b]}
              title={BLOCK_LABELS[b]}
            >
              {BLOCK_LABELS[b]}
            </button>
          ))}
        </div>

        <span className={styles.sep} aria-hidden="true" />

        <div className={styles.group}>
          <button
            type="button"
            className={`${styles.btn} ${isActive('bold') ? styles.btnActive : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('bold')}
            aria-label="Negrito"
            title="Negrito (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${isActive('italic') ? styles.btnActive : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('italic')}
            aria-label="Itálico"
            title="Itálico (Ctrl+I)"
          >
            <em>I</em>
          </button>
        </div>

        <span className={styles.sep} aria-hidden="true" />

        <div className={styles.group}>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertLink}
            aria-label="Inserir link"
            title="Inserir link"
          >
            <IconLink size={14} />
          </button>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('insertUnorderedList')}
            aria-label="Lista com marcadores"
            title="Lista com marcadores"
          >
            •
          </button>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('insertOrderedList')}
            aria-label="Lista numerada"
            title="Lista numerada"
          >
            1.
          </button>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('formatBlock', '<blockquote>')}
            aria-label="Citação"
            title="Citação"
          >
            ❝
          </button>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('formatBlock', '<pre>')}
            aria-label="Bloco de código"
            title="Código"
          >
            {'</>'}
          </button>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertHr}
            aria-label="Separador horizontal"
            title="Separador"
          >
            —
          </button>
        </div>

        <span className={styles.sep} aria-hidden="true" />

        <div className={styles.group}>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={openImageDialog}
            aria-label="Inserir imagem"
            title="Inserir imagem"
          >
            <IconImage size={14} />
          </button>
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertVideo}
            aria-label="Inserir vídeo"
            title="Inserir vídeo (YouTube, Vimeo, MP4)"
          >
            <IconVideo size={14} />
          </button>
        </div>

        <div className={styles.toolbarSpacer} />

        <Button
          variant={preview ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? 'Editar' : 'Preview'}
        </Button>
      </div>

      {preview ? (
        <div
          className={styles.preview}
          // Conteúdo controlado pela própria UI do editor → ok
          // renderizar via dangerouslySetInnerHTML. Sanitização
          // server-side é OBRIGATÓRIA antes de qualquer storage
          // ou render público.
          dangerouslySetInnerHTML={{ __html: value || '<p><em>Nada ainda…</em></p>' }}
        />
      ) : (
        <div
          ref={editorRef}
          className={styles.editor}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={refreshToolbar}
          onMouseUp={refreshToolbar}
          onFocus={refreshToolbar}
          aria-label="Editor de conteúdo"
          data-placeholder={placeholder}
        />
      )}

      {/* Dialog de inserir imagem inline — uploader + alt em um
       *  só passo. Substitui o window.prompt anterior. O Confirmar
       *  só habilita quando há URL (post-upload) + alt preenchido. */}
      <Dialog
        open={imageDialog.open}
        onClose={() => setImageDialog({ open: false, url: '', alt: '' })}
        title="Inserir imagem"
        description="Envie um arquivo e descreva o conteúdo da imagem. O alt é importante pra SEO e acessibilidade."
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setImageDialog({ open: false, url: '', alt: '' })
              }
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!imageDialog.url || !imageDialog.alt.trim()}
              onClick={confirmImageDialog}
            >
              Inserir
            </Button>
          </>
        }
      >
        <div className={styles.imageDialogBody}>
          <BlogImageUploader
            value={imageDialog.url}
            onChange={(url) =>
              setImageDialog((prev) => ({ ...prev, url }))
            }
            aspectRatio="16/9"
          />
          <Input
            label="Descrição (alt)"
            required
            value={imageDialog.alt}
            placeholder="O que aparece na imagem? Ex.: Ana Castela no palco de Linlithgow."
            helperText="Recomendado pra leitores de tela + crawlers (SEO)."
            onChange={(e) =>
              setImageDialog((prev) => ({ ...prev, alt: e.target.value }))
            }
          />
        </div>
      </Dialog>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────── */

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Detecta YouTube / Vimeo / arquivo direto e devolve URL embeddable. */
function toEmbedSrc(input: string): { type: 'iframe' | 'video'; url: string } | null {
  // YouTube — vários formatos
  const yt = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (yt) {
    return {
      type: 'iframe',
      url: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`,
    };
  }
  // Vimeo
  const vimeo = input.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return { type: 'iframe', url: `https://player.vimeo.com/video/${vimeo[1]}` };
  }
  // MP4/WebM
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(input)) {
    return { type: 'video', url: input };
  }
  return null;
}
