'use client';

import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import {
  IconBan,
  IconShield,
  IconCheckCircle,
  IconMessage,
  IconCalendar,
  IconMusic,
} from '@/components/icons';
import type { User } from '@/types';
import { formatDateTime } from '@/lib/format';
import styles from './UserDetailDrawer.module.css';

const SEX_LABEL: Record<User['sex'], string> = {
  M: 'Masculino',
  F: 'Feminino',
  Outro: 'Outro',
  NaoInformado: 'Prefere não informar',
};

export interface UserDetailDrawerProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onBan: (user: User) => void;
  onBlock: (user: User) => void;
}

export default function UserDetailDrawer({
  user,
  open,
  onClose,
  onBan,
  onBlock,
}: UserDetailDrawerProps) {
  if (!user) {
    return <Drawer open={open} onClose={onClose}>{null}</Drawer>;
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className={styles.headerInner}>
          <Avatar name={user.name} src={user.avatar} size="lg" />
          <div className={styles.headerText}>
            <span className={styles.headerName}>{user.name}</span>
            <span className={styles.headerLocation}>
              {user.city}-{user.state}
            </span>
          </div>
        </div>
      }
    >
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Dados completos</span>
          <span className={styles.sectionDescription}>
            Registro cadastral principal do usuário selecionado.
          </span>
        </div>

        <div className={styles.dataCard}>
          <div className={styles.dataCol}>
            <span className={styles.eyebrow}>Contato</span>
            <span className={styles.dataItem}>
              <IconMessage size={14} />
              {user.email}
            </span>
            <span className={styles.dataItem}>
              <IconShield size={14} />
              {user.city}-{user.state}
            </span>
          </div>
          <div className={styles.dataCol}>
            <span className={styles.eyebrow}>Dados cadastrados</span>
            <span className={styles.dataField}>
              <b>Idade:</b> {user.age} anos
            </span>
            <span className={styles.dataField}>
              <b>Sexo:</b> {SEX_LABEL[user.sex]}
            </span>
            <span className={styles.dataField}>
              <b>Telefone:</b> {user.phone}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="outline"
            size="md"
            leadingIcon={<IconShield size={14} />}
            onClick={() => onBlock(user)}
            disabled={user.status === 'suspended' || user.status === 'banned'}
          >
            Bloquear usuário
          </Button>
          <Button
            variant="danger"
            size="md"
            leadingIcon={<IconBan size={14} />}
            onClick={() => onBan(user)}
            disabled={user.status === 'banned'}
          >
            Banir usuário
          </Button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Logs</span>
          <span className={styles.sectionDescription}>
            Eventos principais para auditoria e análise rápida.
          </span>
        </div>

        <div className={styles.logCard}>
          <span className={styles.logCardHead}>
            <IconCheckCircle size={12} strokeWidth={2.2} />
            Aceite dos termos
          </span>
          <span className={styles.logCardValue}>
            {formatDateTime(user.termsAcceptedAt)}
          </span>
        </div>

        <span className={styles.streamsHeading}>Últimos streams</span>

        {user.streamHistory.length === 0 ? (
          <div className={styles.streamCard}>
            <span className={styles.streamMeta}>
              Sem reproduções registradas até agora.
            </span>
          </div>
        ) : (
          user.streamHistory.slice(0, 5).map((s, i) => (
            <div key={`${s.title}-${i}`} className={styles.streamCard}>
              <span className={styles.streamTitle}>
                <IconMusic size={12} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 6 }} />
                {s.title}
              </span>
              <span className={styles.streamMeta}>
                <IconCalendar size={11} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                {formatDateTime(s.playedAt)}
                {s.artist && <span className={styles.streamArtist}> · {s.artist}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
