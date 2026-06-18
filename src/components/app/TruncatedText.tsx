'use client';

import {
  useEffect,
  useState,
  type ElementType,
  type ReactNode,
} from 'react';

interface TruncatedTextProps {
  /** Elemento renderizado. Default: 'span'. */
  as?: ElementType;
  /** Conteúdo exibido (e usado como tooltip quando cortado). */
  children: ReactNode;
  /**
   * Texto completo pro tooltip. Use quando o conteúdo renderizado não
   * é uma string simples (ex.: nome + badge) — aí passe o texto puro.
   */
  title?: string;
  className?: string;
  [key: string]: unknown;
}

/**
 * Texto de linha única que ganha o atributo nativo `title` (tooltip no
 * hover + lido por leitores de tela) com o conteúdo completo APENAS
 * quando ele está de fato truncado (scrollWidth > clientWidth). O
 * `text-overflow: ellipsis` continua vindo da className do consumidor.
 *
 * Acessibilidade: garante que qualquer rótulo/frase que não cabe no
 * espaço disponível ainda seja consultável por completo, sem poluir
 * com tooltip os textos que cabem inteiros.
 */
export default function TruncatedText({
  as: Tag = 'span',
  children,
  title,
  className,
  ...rest
}: TruncatedTextProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  const full =
    title ?? (typeof children === 'string' ? children : undefined);

  useEffect(() => {
    if (!node) return;
    const check = () => {
      // +1 absorve arredondamento sub-pixel do layout.
      setOverflowing(node.scrollWidth - node.clientWidth > 1);
    };
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, children, title]);

  return (
    <Tag
      ref={setNode}
      className={className}
      title={overflowing && full ? full : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
