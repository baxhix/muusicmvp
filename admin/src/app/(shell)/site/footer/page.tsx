'use client';

import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { IconAlert } from '@/components/icons';
import styles from '../faq/page.module.css';

/**
 * Footer — placeholder. CRUD pra editar o conteúdo do footer
 * do site público (CNPJ, direitos autorais, redes sociais).
 * Próxima fase: schema `site_footer` (singleton com JSONB de
 * campos) + endpoint admin + render dinâmico no /teste Footer.
 */
export default function FooterAdminPage() {
  return (
    <>
      <PageHeader
        title="Footer"
        description="Dados do rodapé do site — CNPJ, direitos autorais, links de redes sociais."
      />
      <div className={styles.body}>
        <Card>
          <CardHeader
            title="CRUD em construção"
            description="Os dados do footer ainda vivem hardcoded em src/components/teste/Footer.tsx."
          />
          <div className={styles.placeholder}>
            <IconAlert size={20} />
            <div>
              <p>Próximos passos planejados:</p>
              <ul>
                <li>Schema <code>site_footer</code> singleton com campos: <code>cnpj</code>, <code>copyright</code>, <code>social_links</code> (JSONB), <code>columns</code> (JSONB).</li>
                <li>Endpoints <code>GET/PUT /api/admin/site/footer</code> + <code>GET /api/site/footer</code> público.</li>
                <li>Editor de formulário no admin.</li>
                <li>Footer público lê do banco em vez de hardcode.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
