'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import Lightbox from './Lightbox';
import styles from './MaterialsTabContent.module.css';

/* Helper pra montar URL de thumbnail de imagem mocada via Picsum.
 * Seed determinístico (id do item) garante que a mesma "foto"
 * aparece em todo render. Tamanhos: 80×60 pro thumb na lista,
 * 1600×1067 pro lightbox fullscreen. */
function thumbUrl(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

/**
 * MaterialsTabContent — tab "Materiais" do ArtistBox (e do
 * flyout do ArtistBoxRail). Mostra um grid 3-col de pastas com
 * conteúdos compartilhados pela Central de Fãs. Algumas pastas
 * são tier-locked (precisa de X Fanpoints pra abrir); o cadeado
 * aparece em cima do ícone e o clique não navega.
 *
 * Click em pasta unlocked → switch pra detail view inline com
 * lista de arquivos + ações view/download. Voltar via back arrow.
 *
 * Dados mocados — 6 pastas + 1 "ver mais" decorativo. Em
 * produção, plugar `useFanMaterials()` ou similar pra buscar do
 * backend admin (acervo de materiais).
 */

type MaterialKind = 'image' | 'video' | 'audio' | 'pdf' | 'document';

interface MaterialItem {
  id: string;
  name: string;
  kind: MaterialKind;
  size: string;
}

interface MaterialFolder {
  id: string;
  name: string;
  /** Fanpoints necessários pra desbloquear. Undefined = sempre aberta. */
  lockedAt?: number;
  items: MaterialItem[];
}

const FOLDERS: MaterialFolder[] = [
  {
    id: 'fotos-turne',
    name: 'Fotos da turnê',
    items: [
      { id: 'f1-1', name: 'Sao Paulo show 1.jpg', kind: 'image', size: '3.2 MB' },
      { id: 'f1-2', name: 'Sao Paulo show 2.jpg', kind: 'image', size: '2.8 MB' },
      { id: 'f1-3', name: 'Rio de Janeiro live.jpg', kind: 'image', size: '4.1 MB' },
      { id: 'f1-4', name: 'Belo Horizonte backstage.jpg', kind: 'image', size: '3.5 MB' },
      { id: 'f1-5', name: 'Salvador acustico.jpg', kind: 'image', size: '2.9 MB' },
    ],
  },
  {
    id: 'bastidores',
    name: 'Bastidores VIP',
    items: [
      { id: 'f2-1', name: 'Camarim Boiadeira.mp4', kind: 'video', size: '48 MB' },
      { id: 'f2-2', name: 'Aquecimento vocal.mp4', kind: 'video', size: '22 MB' },
      { id: 'f2-3', name: 'Roteiro do show.pdf', kind: 'pdf', size: '1.2 MB' },
    ],
  },
  {
    id: 'demos',
    name: 'Demos exclusivas',
    /* Threshold subiu de 5k → 500k per product feedback "Só estão
     * sendo exibidas pastas desbloqueadas" — o user de teste tem
     * ~402k FP, então qualquer valor abaixo disso renderiza como
     * livre. 500k garante locked enquanto não passar do threshold. */
    lockedAt: 500_000,
    items: [
      { id: 'f3-1', name: 'Pipoco - demo voz.mp3', kind: 'audio', size: '5.1 MB' },
      { id: 'f3-2', name: 'Solteiro - demo violao.mp3', kind: 'audio', size: '4.7 MB' },
    ],
  },
  {
    id: 'letras',
    name: 'Letras manuscritas',
    items: [
      { id: 'f4-1', name: 'Boiadeira - rascunho.pdf', kind: 'pdf', size: '850 KB' },
      { id: 'f4-2', name: 'Nosso Quadro - letra original.pdf', kind: 'pdf', size: '1.1 MB' },
      { id: 'f4-3', name: 'Folder de turne.pdf', kind: 'pdf', size: '2.3 MB' },
    ],
  },
  {
    id: 'backstage-fonte-nova',
    name: 'Backstage Fonte Nova',
    items: [
      { id: 'f5-1', name: 'Passagem de som.mp4', kind: 'video', size: '92 MB' },
      { id: 'f5-2', name: 'Encontro de fas.mp4', kind: 'video', size: '64 MB' },
      { id: 'f5-3', name: 'Saida do palco.mp4', kind: 'video', size: '38 MB' },
    ],
  },
  {
    id: 'lives-privadas',
    name: 'Lives privadas',
    /* Threshold ainda mais alto (1M) — tier "raro". */
    lockedAt: 1_000_000,
    items: [
      { id: 'f6-1', name: 'Live de aniversario.mp4', kind: 'video', size: '120 MB' },
      { id: 'f6-2', name: 'Live solo violao.mp4', kind: 'video', size: '85 MB' },
    ],
  },
];

/* Pastas extras carregadas via "Ver mais" — per spec "ao clicar
 * Ver mais, simule mais 6 pastas com conteúdos mocados". Mistura
 * de imagens e vídeos com tiers variados. */
const EXTRA_FOLDERS: MaterialFolder[] = [
  {
    id: 'ensaios-fotograficos',
    name: 'Ensaios fotográficos',
    items: [
      { id: 'f7-1', name: 'Ensaio Vogue Brasil.jpg', kind: 'image', size: '5.2 MB' },
      { id: 'f7-2', name: 'Ensaio Caras.jpg', kind: 'image', size: '4.8 MB' },
      { id: 'f7-3', name: 'Capa Quem Magazine.jpg', kind: 'image', size: '6.1 MB' },
      { id: 'f7-4', name: 'Ensaio editorial 2024.jpg', kind: 'image', size: '7.3 MB' },
    ],
  },
  {
    id: 'clipes-bts',
    name: 'BTS dos clipes',
    items: [
      { id: 'f8-1', name: 'Pipoco - making of.mp4', kind: 'video', size: '156 MB' },
      { id: 'f8-2', name: 'Solteiro - bastidores.mp4', kind: 'video', size: '98 MB' },
      { id: 'f8-3', name: 'Nosso Quadro - set design.jpg', kind: 'image', size: '3.8 MB' },
      { id: 'f8-4', name: 'Boiadeira - prep.jpg', kind: 'image', size: '4.2 MB' },
    ],
  },
  {
    id: 'meet-greet',
    name: 'Meet & Greet',
    lockedAt: 50_000,
    items: [
      { id: 'f9-1', name: 'Fas SP - foto oficial.jpg', kind: 'image', size: '4.5 MB' },
      { id: 'f9-2', name: 'Fas RJ - foto oficial.jpg', kind: 'image', size: '4.3 MB' },
      { id: 'f9-3', name: 'Encontro Boiadeiros.mp4', kind: 'video', size: '72 MB' },
    ],
  },
  {
    id: 'estudio-gravacao',
    name: 'Estúdio de gravação',
    lockedAt: 25_000,
    items: [
      { id: 'f10-1', name: 'Sessao de gravacao.mp4', kind: 'video', size: '210 MB' },
      { id: 'f10-2', name: 'Mesa de mixagem.jpg', kind: 'image', size: '3.7 MB' },
      { id: 'f10-3', name: 'Time de producao.jpg', kind: 'image', size: '4.1 MB' },
      { id: 'f10-4', name: 'Cabine de voz.jpg', kind: 'image', size: '3.9 MB' },
    ],
  },
  {
    id: 'turne-internacional',
    name: 'Turnê internacional',
    items: [
      { id: 'f11-1', name: 'Show em Lisboa.mp4', kind: 'video', size: '180 MB' },
      { id: 'f11-2', name: 'Show em Madrid.mp4', kind: 'video', size: '165 MB' },
      { id: 'f11-3', name: 'Bastidores Europa.jpg', kind: 'image', size: '5.5 MB' },
      { id: 'f11-4', name: 'Fas em Paris.jpg', kind: 'image', size: '4.8 MB' },
    ],
  },
  {
    id: 'colaboracoes',
    name: 'Colaborações',
    lockedAt: 10_000,
    items: [
      { id: 'f12-1', name: 'Feat com Marilia.mp4', kind: 'video', size: '95 MB' },
      { id: 'f12-2', name: 'Feat com Henrique.mp4', kind: 'video', size: '88 MB' },
      { id: 'f12-3', name: 'Encontro de artistas.jpg', kind: 'image', size: '4.6 MB' },
    ],
  },
];

export function MaterialsTabContent() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  /* Lightbox state — agora é um CAROUSEL: armazena o index do
   *  item clicado dentro da lista de previewáveis da pasta. -1 =
   *  fechado. O Lightbox component navega entre os itens via
   *  setas/arrow keys/swipe e exibe fullscreen edge-to-edge. */
  const [lightboxIdx, setLightboxIdx] = useState<number>(-1);
  /* "Ver mais" expand — quando true, EXTRA_FOLDERS são
   * concatenadas no grid. Per spec "ao clicar Ver mais, simule
   * mais 6 pastas com conteúdos mocados". */
  const [expanded, setExpanded] = useState(false);
  const allFolders = expanded ? [...FOLDERS, ...EXTRA_FOLDERS] : FOLDERS;

  /* Busca pasta em AMBOS arrays (base + extras) pra que ao expandir
   * e abrir uma pasta nova, ela seja encontrada. */
  const openFolder = openFolderId
    ? [...FOLDERS, ...EXTRA_FOLDERS].find((f) => f.id === openFolderId)
    : null;

  /* Lista de itens previewáveis (image + video) da pasta aberta —
   *  é o que vira o carousel do Lightbox. */
  const previewableItems = openFolder
    ? openFolder.items.filter((i) => i.kind === 'image' || i.kind === 'video')
    : [];

  /* Body scroll lock + escape key — só ativos quando lightbox tá
   *  aberto. ←/→ keys são tratados dentro do CarouselLightbox. */
  useEffect(() => {
    if (lightboxIdx < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(-1);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIdx]);

  /* Detail view — lista de arquivos da pasta aberta. */
  if (openFolder) {
    return (
      <>
        <div className={styles.detail}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setOpenFolderId(null)}
            aria-label="Voltar para pastas"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Pastas</span>
          </button>
          <h3 className={styles.detailTitle}>{openFolder.name}</h3>
          <div className={styles.fileList}>
            {openFolder.items.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                /* Imagens E vídeos são previewáveis (clique em
                 * thumb OU nome abre o lightbox carousel) per
                 * spec "deixe o nome da imagem ou vídeo e a
                 * miniatura clicável". */
                onPreview={
                  item.kind === 'image' || item.kind === 'video'
                    ? () => {
                        const idx = previewableItems.findIndex(
                          (p) => p.id === item.id,
                        );
                        setLightboxIdx(idx >= 0 ? idx : 0);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
        {/* Lightbox compartilhado — padrão único da plataforma
         *  (chat, álbuns, pastas exclusivas). Mapeamos MaterialItem
         *  pro shape genérico LightboxItem. */}
        {lightboxIdx >= 0 && previewableItems[lightboxIdx] && (
          <Lightbox
            items={previewableItems.map((m) => {
              const url = thumbUrl(m.id, 1920, 1280);
              return {
                id: m.id,
                src: url,
                alt: m.name,
                name: m.name,
                downloadUrl: url,
                downloadName: m.name,
              };
            })}
            index={lightboxIdx}
            onIndexChange={setLightboxIdx}
            onClose={() => setLightboxIdx(-1)}
          />
        )}
      </>
    );
  }

  /* Grid view — 3 colunas de pastas, locked condicional a fanpoints. */
  return (
    <div className={styles.materials}>
      <div className={styles.grid}>
        {allFolders.map((f) => {
          const locked = f.lockedAt !== undefined && fanpoints < f.lockedAt;
          return (
            <FolderCard
              key={f.id}
              folder={f}
              locked={locked}
              onClick={() => {
                if (!locked) setOpenFolderId(f.id);
              }}
            />
          );
        })}
      </div>
      {!expanded && (
        <button
          type="button"
          className={styles.viewMore}
          aria-label="Ver mais materiais"
          onClick={() => setExpanded(true)}
        >
          Ver mais
        </button>
      )}
    </div>
  );
}

function FolderCard({
  folder,
  locked,
  onClick,
}: {
  folder: MaterialFolder;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.folder} ${locked ? styles.folderLocked : ''}`}
      onClick={onClick}
      aria-label={
        locked
          ? `${folder.name} — bloqueada, precisa de ${folder.lockedAt?.toLocaleString('pt-BR')} Fanpoints`
          : `Abrir ${folder.name}`
      }
      disabled={locked}
    >
      <div className={styles.folderIconWrap}>
        {/* Pasta com gradient inline quando livre / cinza quando
         * bloqueada. O gradient `folderGradient` vive no <defs>
         * dentro do próprio SVG — multiplas instâncias na mesma
         * página declaram o mesmo id sem conflito (browsers
         * resolvem por gradient referenciado dentro do mesmo
         * svg root). */}
        <svg viewBox="0 0 24 24" fill="none" className={styles.folderIcon} aria-hidden="true">
          <defs>
            <linearGradient id="folderGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#f97316" />
              <stop offset="50%"  stopColor="#ec4899" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
            fill={locked ? 'currentColor' : 'url(#folderGradient)'}
          />
        </svg>
        {locked && (
          <span className={styles.lockBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 1a5 5 0 0 0-5 5v4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 9V6a3 3 0 1 1 6 0v4H9z" />
            </svg>
          </span>
        )}
      </div>
      <span className={styles.folderName}>{folder.name}</span>
      {locked && (
        <span className={styles.folderMeta}>
          {folder.lockedAt?.toLocaleString('pt-BR')} FP
        </span>
      )}
    </button>
  );
}

function FileRow({
  item,
  onPreview,
}: {
  item: MaterialItem;
  /** Quando definido, item é tratado como visualizável (imagem
   * ou vídeo) — thumbnail E nome viram clicáveis (botão olho
   * também). */
  onPreview?: () => void;
}) {
  const isImage = item.kind === 'image';
  const isVideo = item.kind === 'video';
  const isPreviewable = isImage || isVideo;
  /* Imagem/vídeo: thumbnail real via Picsum (seed = item.id).
   * Pra vídeos, mostra a foto + play overlay no canto. Outros
   * tipos mantêm o ícone SVG colorido. */
  const thumbContent = isPreviewable ? (
    <>
      {/* Thumb img — simples, sem layoutId. O Lightbox compartilhado
       *  cuida do fade-in/out via opacity quando monta. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl(item.id, 80, 60)}
        alt={item.name}
        className={styles.fileThumbImg}
        loading="lazy"
      />
      {isVideo && (
        <span className={styles.fileVideoBadge} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      )}
    </>
  ) : (
    <FileKindIcon kind={item.kind} />
  );

  return (
    <div className={styles.fileRow}>
      {onPreview ? (
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Abrir ${item.name}`}
          className={`${styles.fileIcon} ${isPreviewable ? styles.fileIconImage : ''}`}
        >
          {thumbContent}
        </button>
      ) : (
        <span
          aria-hidden="true"
          className={`${styles.fileIcon} ${isPreviewable ? styles.fileIconImage : ''}`}
        >
          {thumbContent}
        </span>
      )}
      {/* Nome também clicável quando previewável per spec "deixe
       * o nome da imagem ou vídeo e a miniatura clicável". Não-
       * previewável (pdf/audio/document) cai pro <div> simples. */}
      {onPreview ? (
        <button
          type="button"
          onClick={onPreview}
          className={`${styles.fileInfo} ${styles.fileInfoButton}`}
          aria-label={`Abrir ${item.name}`}
        >
          <span className={styles.fileName}>{item.name}</span>
          <span className={styles.fileSize}>{item.size}</span>
        </button>
      ) : (
        <div className={styles.fileInfo}>
          <span className={styles.fileName}>{item.name}</span>
          <span className={styles.fileSize}>{item.size}</span>
        </div>
      )}
      <div className={styles.fileActions}>
        <button
          type="button"
          className={styles.fileBtn}
          aria-label={`Visualizar ${item.name}`}
          onClick={onPreview}
          disabled={!onPreview}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <a
          className={styles.fileBtn}
          href={isImage ? thumbUrl(item.id, 1600, 1067) : '#'}
          download={item.name}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Baixar ${item.name}`}
          onClick={(e) => {
            if (!isImage) e.preventDefault();
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function FileKindIcon({ kind }: { kind: MaterialKind }) {
  /* Single set of strokes per kind — fica leve e fácil de scanear
   * visualmente. Cor herda do parent (.fileIcon) via currentColor. */
  if (kind === 'image') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (kind === 'video') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    );
  }
  if (kind === 'audio') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  if (kind === 'pdf') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
  /* document fallback */
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}
