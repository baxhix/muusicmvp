'use client';

import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import {
  IconDownload,
  IconTrash,
  IconFeed,
  IconHeart,
  IconEdit,
} from '@/components/icons';
import {
  MATERIAL_STATUS_LABEL,
  MATERIAL_AUDIENCE_META,
  MATERIAL_AUDIENCE_ORDER,
  type MaterialFile,
  type MaterialStatus,
  type MaterialAudience,
} from '@/data/mock/materiais';
import { formatNumber, formatDateLong } from '@/lib/format';
import { formatBytes } from './shared';
import styles from './MaterialPreviewDrawer.module.css';

const STATUS_TONE: Record<MaterialStatus, BadgeTone> = {
  rascunho:  'neutral',
  publicado: 'success',
  agendado:  'info',
  arquivado: 'warning',
};

export interface MaterialPreviewDrawerProps {
  file: MaterialFile | null;
  onClose: () => void;
  onDownload: (file: MaterialFile) => void;
  onDelete: (file: MaterialFile) => void;
  /** Handler de mudança da audiência do material. Recebe id +
   *  novo tier — page é responsável por persistir. */
  onAudienceChange: (fileId: string, audience: MaterialAudience) => void;
  /** Abre o RenameDialog pra renomear o arquivo. */
  onRename: (file: MaterialFile) => void;
}

/**
 * Drawer de preview de arquivo — abre quando o usuário clica num
 * card de file na grid. Mostra thumb grande, metadados, controle
 * de audiência (Top 1/10/50/100/Todos) e dois CTAs: Download e
 * Excluir.
 */
export default function MaterialPreviewDrawer({
  file,
  onClose,
  onDownload,
  onDelete,
  onAudienceChange,
  onRename,
}: MaterialPreviewDrawerProps) {
  if (!file) return null;

  const isImage = ['jpg', 'png', 'svg'].includes(file.formato);

  /* Options pro Select de audiência — ordenadas do mais restrito
   * pro mais aberto, com descrição inline pra contextualizar. */
  const audienceOptions = MATERIAL_AUDIENCE_ORDER.map((id) => ({
    value: id,
    label: MATERIAL_AUDIENCE_META[id].label,
  }));

  const currentAudience = MATERIAL_AUDIENCE_META[file.audience];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={file.name}
      description={file.description}
      size="lg"
      footer={
        <div className={styles.footerActions}>
          <Button
            variant="ghost"
            size="md"
            leadingIcon={<IconEdit size={14} />}
            onClick={() => onRename(file)}
          >
            Renomear
          </Button>
          <Button
            variant="primary"
            size="md"
            leadingIcon={<IconDownload size={14} />}
            onClick={() => onDownload(file)}
          >
            Download
          </Button>
          <Button
            variant="danger"
            size="md"
            leadingIcon={<IconTrash size={14} />}
            onClick={() => onDelete(file)}
          >
            Excluir
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {/* Preview area — imagem real ou placeholder. */}
        <div className={styles.previewBox}>
          {isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={file.thumb}
              alt={file.name}
              className={styles.previewImg}
            />
          ) : (
            <div className={styles.previewPlaceholder}>
              <div className={styles.placeholderFormat}>
                {file.formato.toUpperCase()}
              </div>
              <div className={styles.placeholderHint}>
                Visualização indisponível pra este formato.
              </div>
            </div>
          )}
        </div>

        {/* Status + flags */}
        <div className={styles.statusRow}>
          <Badge tone={STATUS_TONE[file.status]} size="sm" dot>
            {MATERIAL_STATUS_LABEL[file.status]}
          </Badge>
          {file.publishedToFeed && (
            <span className={styles.feedFlag} title="Também publicado no feed">
              <IconFeed size={11} /> Publicado no feed
            </span>
          )}
        </div>

        {/* Bloco de Audiência — controle dedicado. Ocupa uma
         *  seção própria porque é a decisão editorial principal
         *  do admin neste material. */}
        <section className={styles.audienceSection}>
          <div className={styles.audienceSectionHead}>
            <h3 className={styles.sectionTitle}>Quem pode acessar</h3>
            <Badge tone={currentAudience.tone} size="sm">
              {currentAudience.shortLabel}
            </Badge>
          </div>
          <p className={styles.audienceDescription}>
            {currentAudience.description}
          </p>
          <Select
            label="Definir audiência"
            value={file.audience}
            onChange={(e) =>
              onAudienceChange(file.id, e.target.value as MaterialAudience)
            }
            options={audienceOptions}
          />
          <p className={styles.audienceHelp}>
            Ranking de superfãs é recalculado diariamente pelo Engajamento. Apenas usuários
            dentro do tier escolhido (ou superior) verão este arquivo no app.
          </p>
        </section>

        {/* Metadados em grid */}
        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt>Formato</dt>
            <dd>{file.formato.toUpperCase()}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Tamanho</dt>
            <dd>{formatBytes(file.tamanhoBytes)}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Downloads</dt>
            <dd>{formatNumber(file.downloads)}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Favoritos</dt>
            <dd>
              <IconHeart size={12} /> {formatNumber(file.favoritos)}
            </dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Publicado em</dt>
            <dd>{formatDateLong(file.publicadoEm)}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Por</dt>
            <dd>{file.createdBy.name}</dd>
          </div>
        </dl>
      </div>
    </Drawer>
  );
}
