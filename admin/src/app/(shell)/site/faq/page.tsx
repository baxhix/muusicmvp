'use client';

import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { IconAlert } from '@/components/icons';
import styles from './page.module.css';

/**
 * FAQ — placeholder. CRUD completo (perguntas + respostas,
 * categorias, ordenação, publicar/despublicar) virá numa fase
 * seguinte, junto com tabela dedicada no banco + endpoints
 * admin + página pública /faq.
 */
export default function FaqAdminPage() {
  return (
    <>
      <PageHeader
        title="FAQ"
        description="Perguntas e respostas que aparecem na seção FAQ pública do site."
      />
      <div className={styles.body}>
        <Card>
          <CardHeader
            title="CRUD em construção"
            description="Esta superfície será habilitada quando o schema do FAQ for criado."
          />
          <div className={styles.placeholder}>
            <IconAlert size={20} />
            <div>
              <p>
                Próximos passos planejados:
              </p>
              <ul>
                <li>Schema <code>faq_entries</code> (id, question, answer, category, order, published_at).</li>
                <li>Endpoints admin <code>GET/POST/PUT/DELETE /api/admin/faq</code>.</li>
                <li>Listagem com drag-and-drop pra ordenar.</li>
                <li>Página pública <code>/faq</code> renderizando o conteúdo.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
