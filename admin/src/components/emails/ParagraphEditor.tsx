'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import styles from './ParagraphEditor.module.css';

type Align = 'left' | 'center' | 'right' | 'justify';

interface ParagraphEditorProps {
  value: string;
  onChange: (html: string) => void;
  align: Align;
  onAlignChange: (a: Align) => void;
  placeholder?: string;
}

/**
 * Editor de parágrafo com toolbar mínimo:
 *   - B  (bold via execCommand sobre a seleção)
 *   - I  (italic via execCommand sobre a seleção)
 *   - 4 alinhamentos (propriedade do bloco, aplica no <p> renderizado)
 *
 * Quebra de linha: Enter E Shift+Enter ambos inserem `<br/>`. Não
 * existe noção de "parágrafo novo" dentro de um bloco — o bloco
 * inteiro é UM <p> no email. Interceptamos os dois pra garantir
 * consistência cross-browser (alguns browsers inserem <div>,
 * outros <p>, outros literal `\n` em pre-wrap).
 *
 * Saída: HTML limitado (strong/b, em/i, br) — sanitizado novamente
 * tanto no renderer client (preview) quanto no server-side antes
 * de enviar o email final (allowlist em design.ts).
 */
export default function ParagraphEditor({
  value,
  onChange,
  align,
  onAlignChange,
  placeholder,
}: ParagraphEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  /* Última versão emitida — pra evitar reescrever innerHTML
   * em cada keystroke, o que destruiria a posição do cursor. */
  const lastEmitted = useRef<string>('');

  /* Sync inicial + quando o value externo diverge muito (ex.:
   * carregamento de template, reset). Não sobrescreve durante
   * edição contínua porque o lastEmitted bate com o estado. */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = value || '';
    lastEmitted.current = value;
  }, [value]);

  function handleInput() {
    const el = editorRef.current;
    if (!el) return;
    /* Normaliza output: contentEditable de alguns browsers
     * envolve linhas em <div> ou <p>. Convertemos isso pra
     * <br/> pra emails renderizarem consistente. Mantemos
     * <strong>, <b>, <br>, <i>, <em> intactos.
     *
     * Também troca `\r\n` / `\n` literais por `<br/>` — o editor
     * usa `white-space: pre-wrap` no CSS, então newlines literais
     * (de paste de texto puro, por exemplo) aparecem como linha
     * nova VISUALMENTE, mas o <p> do email não tem pre-wrap e
     * colapsaria pra um espaço. Convertemos pra <br/> aqui pra
     * que o saved value seja idêntico ao que o user vê. */
    const html = el.innerHTML
      .replace(/<div><br\s*\/?><\/div>/gi, '<br/>')
      .replace(/<div>/gi, '<br/>')
      .replace(/<\/div>/gi, '')
      .replace(/<p>/gi, '<br/>')
      .replace(/<\/p>/gi, '')
      .replace(/\r\n/g, '<br/>')
      .replace(/\n/g, '<br/>');
    lastEmitted.current = html;
    onChange(html);
  }

  /* Intercepta Enter / Shift+Enter: ambos inserem <br/> via
   * execCommand. O default do contentEditable varia muito —
   * Chrome envolve em <div>, Firefox em <br>, Safari pode usar
   * `\n` literal em pre-wrap — e a normalização no handleInput
   * é frágil pros casos raros (ex.: paste seguido de enter no
   * meio do texto). Forçando `<br/>` aqui, o saved value bate
   * 1:1 com o que aparece no email. */
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    /* `insertLineBreak` é o comando idiomático e cross-browser
     * pra inserir <br/>. Fallback pra insertHTML caso o browser
     * não suporte (raro mas seguro). */
    const ok = document.execCommand('insertLineBreak');
    if (!ok) {
      document.execCommand('insertHTML', false, '<br/>');
    }
    handleInput();
  }

  function applyBold(e: React.MouseEvent) {
    e.preventDefault(); // não tira o focus do editor
    editorRef.current?.focus();
    document.execCommand('bold');
    handleInput();
  }

  function applyItalic(e: React.MouseEvent) {
    e.preventDefault(); // não tira o focus do editor
    editorRef.current?.focus();
    /* execCommand('italic') gera <i> ou <em> dependendo do
     * browser — ambos passam pelo sanitizer (allowlist em
     * design.ts cobre os dois). */
    document.execCommand('italic');
    handleInput();
  }

  function setAlign(a: Align) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      onAlignChange(a);
    };
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatação">
        <button
          type="button"
          className={styles.btn}
          onMouseDown={applyBold}
          aria-label="Negrito"
          title="Negrito (Ctrl+B)"
        >
          <span style={{ fontWeight: 800 }}>B</span>
        </button>
        <button
          type="button"
          className={styles.btn}
          onMouseDown={applyItalic}
          aria-label="Itálico"
          title="Itálico (Ctrl+I)"
        >
          <span style={{ fontStyle: 'italic', fontFamily: 'serif' }}>I</span>
        </button>
        <span className={styles.sep} aria-hidden="true" />
        <button
          type="button"
          className={cn(styles.btn, align === 'left' && styles.btnActive)}
          onMouseDown={setAlign('left')}
          aria-label="Alinhar à esquerda"
          aria-pressed={align === 'left'}
          title="Alinhar à esquerda"
        >
          <AlignIcon variant="left" />
        </button>
        <button
          type="button"
          className={cn(styles.btn, align === 'center' && styles.btnActive)}
          onMouseDown={setAlign('center')}
          aria-label="Centralizar"
          aria-pressed={align === 'center'}
          title="Centralizar"
        >
          <AlignIcon variant="center" />
        </button>
        <button
          type="button"
          className={cn(styles.btn, align === 'right' && styles.btnActive)}
          onMouseDown={setAlign('right')}
          aria-label="Alinhar à direita"
          aria-pressed={align === 'right'}
          title="Alinhar à direita"
        >
          <AlignIcon variant="right" />
        </button>
        <button
          type="button"
          className={cn(styles.btn, align === 'justify' && styles.btnActive)}
          onMouseDown={setAlign('justify')}
          aria-label="Justificar"
          aria-pressed={align === 'justify'}
          title="Justificar"
        >
          <AlignIcon variant="justify" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={styles.editor}
        onInput={handleInput}
        onBlur={handleInput}
        onKeyDown={handleKeyDown}
        style={{ textAlign: align }}
        role="textbox"
        aria-label="Texto do parágrafo"
        data-placeholder={placeholder ?? 'Digite o texto…'}
      />
    </div>
  );
}

/* ── Mini-icons inline (sem dep) ─────────────────────────────── */

function AlignIcon({ variant }: { variant: Align }) {
  const lines: { x1: number; x2: number; y: number }[] =
    variant === 'left'
      ? [
          { x1: 3, x2: 17, y: 7 },
          { x1: 3, x2: 13, y: 11 },
          { x1: 3, x2: 17, y: 15 },
          { x1: 3, x2: 13, y: 19 },
        ]
      : variant === 'right'
        ? [
            { x1: 7, x2: 21, y: 7 },
            { x1: 11, x2: 21, y: 11 },
            { x1: 7, x2: 21, y: 15 },
            { x1: 11, x2: 21, y: 19 },
          ]
        : variant === 'center'
          ? [
              { x1: 5, x2: 19, y: 7 },
              { x1: 8, x2: 16, y: 11 },
              { x1: 5, x2: 19, y: 15 },
              { x1: 8, x2: 16, y: 19 },
            ]
          : /* justify */ [
              { x1: 3, x2: 21, y: 7 },
              { x1: 3, x2: 21, y: 11 },
              { x1: 3, x2: 21, y: 15 },
              { x1: 3, x2: 21, y: 19 },
            ];

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} />
      ))}
    </svg>
  );
}
