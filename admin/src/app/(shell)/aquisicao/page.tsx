'use client';

import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import styles from './page.module.css';

/**
 * Aquisição — entrada de sidebar criada como placeholder.
 *
 * Funcionalidade ainda não definida no produto. Esta página
 * existe pra que o menu apareça na sidebar (parte do grupo
 * "Growth") sem 404. Quando o time decidir o escopo (canais
 * pagos? landing pages? UTMs?), basta substituir o conteúdo
 * abaixo.
 */
export default function AquisicaoPage() {
  return (
    <>
      <PageHeader
        title="Aquisição"
        description="Canais e métricas de aquisição de novos usuários."
      />
      <div className={styles.body}>
        <Card>
          <CardHeader
            title={
              <span className={styles.titleRow}>
                Em construção
                <Badge tone="warning" size="sm">Roadmap</Badge>
              </span>
            }
            description="Esta página será preenchida quando o escopo de aquisição for definido (canais pagos, UTM tracking, landing pages, custo por aquisição)."
          />
          <div className={styles.placeholder}>
            <p>Sugestões pra esta tela quando o time priorizar:</p>
            <ul>
              <li>Funil de cadastro (visita → magic-link → onboarding completo)</li>
              <li>Origem (UTM source/medium/campaign) com taxa de conversão</li>
              <li>CAC por canal e CPA por campanha</li>
              <li>Cohorts D+1, D+7, D+30 de retenção pós-cadastro</li>
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
