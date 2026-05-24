'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import {
  IconMail,
  IconCheckCircle,
  IconBan,
  IconRefresh,
} from '@/components/icons';
import { formatNumber, formatPercent } from '@/lib/format';
import { emailsService, type EmailMetrics } from '@/services/emails';
import styles from './MetricsTab.module.css';

/**
 * Métricas dos últimos 30 dias.
 *
 *   - 4 StatCards: total, sent, falhas (%), latência média
 *   - Tabela "por kind"
 *   - Mini-gráfico daily (barras SVG simples — sem dep)
 *
 * Estado vazio quando a tabela `email_logs` ainda não tem nada
 * registrado (primeiros dias após a feature ir pra prod).
 */
export default function MetricsTab() {
  const [data, setData] = useState<EmailMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    emailsService.metrics
      .get(30)
      .then((m) => {
        if (!cancel) setData(m);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(msg);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <CardHeader title="Erro ao carregar métricas" description={error} />
      </Card>
    );
  }

  const last = data?.last30d;
  const isEmpty = last && last.total === 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.kpiGrid}>
        <StatCard
          icon={<IconMail size={14} />}
          value={last ? formatNumber(last.total) : '—'}
          label="Total de envios (30d)"
        />
        <StatCard
          icon={<IconCheckCircle size={14} />}
          value={last ? formatNumber(last.sent) : '—'}
          label="Sucessos"
        />
        <StatCard
          icon={<IconBan size={14} />}
          value={last ? formatNumber(last.failed) : '—'}
          secondary={last && last.total > 0 ? formatPercent(last.failureRate) : undefined}
          label="Falhas"
        />
        <StatCard
          icon={<IconRefresh size={14} />}
          value={
            last && last.avgDurationMs !== null
              ? `${Math.round(last.avgDurationMs)} ms`
              : '—'
          }
          label="Latência média Resend"
        />
      </div>

      {isEmpty && (
        <Card>
          <CardHeader
            title="Sem envios ainda"
            description="Quando o sistema disparar emails (ex.: magic link), os registros aparecem aqui. Cada envio é gravado em audit trail automaticamente."
          />
        </Card>
      )}

      {data && data.byKindLast30d.length > 0 && (
        <Card>
          <CardHeader
            title="Por tipo de email"
            description="Distribuição agregada dos últimos 30 dias."
          />
          <table className={styles.kindTable}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Total</th>
                <th>Sucesso</th>
                <th>Falhas</th>
              </tr>
            </thead>
            <tbody>
              {data.byKindLast30d.map((row) => (
                <tr key={row.kind}>
                  <td className={styles.kindCell}>{row.kind}</td>
                  <td>{formatNumber(row.total)}</td>
                  <td className={styles.sentCell}>{formatNumber(row.sent)}</td>
                  <td className={row.failed > 0 ? styles.failedCell : ''}>
                    {formatNumber(row.failed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data && data.daily.length > 0 && (
        <Card>
          <CardHeader
            title="Envios por dia"
            description="Pulso de saída do servidor. Barras vermelhas = falhas."
          />
          <div className={styles.chart}>
            {data.daily.map((d) => {
              const max = Math.max(
                ...data.daily.map((dd) => dd.sent + dd.failed),
              );
              const total = d.sent + d.failed;
              const h = max > 0 ? (total / max) * 100 : 0;
              const fail = total > 0 ? (d.failed / total) * 100 : 0;
              return (
                <div
                  key={d.day}
                  className={styles.bar}
                  title={`${d.day} — ${d.sent} sucesso${
                    d.failed > 0 ? `, ${d.failed} falhas` : ''
                  }`}
                  style={{ height: `${Math.max(4, h)}%` }}
                >
                  <span
                    className={styles.barFail}
                    style={{ height: `${fail}%` }}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
