'use client';

import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { IconAlert } from '@/components/icons';
import styles from '../faq/page.module.css';

/**
 * LGPD — placeholder pro CRUD de Termos de Uso + Política de
 * Privacidade. Dois documentos versionados, exibidos em
 * /termos e /privacidade. Próxima fase implementa o schema +
 * editor rich text + histórico de versões.
 */
export default function LgpdAdminPage() {
  return (
    <>
      <PageHeader
        title="LGPD"
        description="Termos de uso e política de privacidade — documentos legais publicados nas páginas públicas."
      />
      <div className={styles.body}>
        <Card>
          <CardHeader
            title="CRUD em construção"
            description="Editor de Termos + Privacidade virá numa próxima fase."
          />
          <div className={styles.placeholder}>
            <IconAlert size={20} />
            <div>
              <p>Próximos passos planejados:</p>
              <ul>
                <li>Schema <code>legal_documents</code> (id, kind: termos|privacidade, version, content, published_at).</li>
                <li>Endpoints admin <code>GET/POST/PUT /api/admin/legal/{`{kind}`}</code>.</li>
                <li>Editor rich-text com histórico de versões + diff.</li>
                <li>Páginas públicas <code>/termos</code> e <code>/privacidade</code>.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
